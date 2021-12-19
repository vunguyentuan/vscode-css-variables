import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  TextEdit,
  Range,
  Position,
} from 'vscode-languageserver/node';

import * as fs from 'fs';
import * as path from 'path';
import {
  getCSSLanguageService,
  getLESSLanguageService,
  getSCSSLanguageService,
} from 'vscode-css-languageservice';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { Symbols } from 'vscode-css-languageservice/lib/umd/parser/cssSymbolScope.js';
import isColor from './utils/isColor';
import { uriToPath } from './utils/protocol';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

type CSSVariable = {
  name: string
  value: string
}

const cachedVariables: Record<string, Map<string, CSSVariable>> = {};

export const getLanguageService = (fileExtension: string) => {
  switch (fileExtension) {
    case '.less':
      return getLESSLanguageService;
    case '.scss':
      return getSCSSLanguageService;
    default:
      return getCSSLanguageService;
  }
};

function getCurrentWord(document: TextDocument, offset: number): string {
  let left = offset - 1;
  let right = offset + 1;
  const text = document.getText();

  while (left >= 0 && ' \t\n\r":{[()]},*>+'.indexOf(text.charAt(left)) === -1) {
    left--;
  }
  
  while (right <= text.length && ' \t\n\r":{[()]},*>+'.indexOf(text.charAt(right)) === -1) {
    right++;
  }

  return text.substring(left, right);
}

function isInFunctionExpression(word: string) : boolean {
  if (word.length < 1) {
    return false;
  }

  return '(' === word.charAt(0);
}

const parseCSSVariablesFromText = ({
  content,
  filePath,
}: {
  content: string
  filePath: string
}) => {
  try {
    const fileExtension = path.extname(filePath);
    const languageService = getLanguageService(fileExtension);
    const service = languageService();

    const styleSheet = service.parseStylesheet(
      TextDocument.create('test://test/test.css', 'css', 0, content)
    );

    const symbolContext = new Symbols(styleSheet);

    symbolContext.global.symbols.forEach((symbol: any) => {
      if (symbol.name.startsWith('--')) {
        if (!cachedVariables[filePath]) {
          cachedVariables[filePath] = new Map();
        }
        if (!cachedVariables['all']) {
          cachedVariables['all'] = new Map();
        }

        // add to cache
        cachedVariables['all'].set(symbol.name, symbol);
        cachedVariables[filePath].set(symbol.name, symbol);
      }
    });
  } catch (error) {
    console.log(error);
  }
};

const blacklistFolders = ['node_modules', 'bower_components', '.git'];

const parseAndSyncVariables = (workspaceFolders: string[]) => {
  workspaceFolders.forEach((folderPath) => {
    const filesToLookup = fs.readdirSync(folderPath, { withFileTypes: true });

    filesToLookup.forEach((relativePath) => {
      if (!blacklistFolders.includes(relativePath.name)) {
        relativePath.isDirectory() &&
          parseAndSyncVariables([path.join(folderPath, relativePath.name)]);

        if (
          relativePath.isFile() &&
          (relativePath.name.endsWith('.less') ||
            relativePath.name.endsWith('.scss') ||
            relativePath.name.endsWith('.css'))
        ) {
          const filePath = path.join(folderPath, relativePath.name);
          const content = fs.readFileSync(filePath, 'utf8');

          parseCSSVariablesFromText({
            content,
            filePath,
          });
        }
      }
    });
  });
};

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;
  parseAndSyncVariables(
    params.workspaceFolders
      ?.map((folder) => uriToPath(folder.uri) || '')
      .filter((path) => !!path) || []
  );

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// The example settings
interface ExampleSettings {
  maxNumberOfProblems: number
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <ExampleSettings>(
      (change.settings.languageServerExample || defaultSettings)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'cssVariablesLanguageServer',
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  // In this simple example we get the settings for every validate run.
  const settings = await getDocumentSettings(textDocument.uri);

  // The validator creates diagnostics for all uppercase words length 2 and more
  const text = textDocument.getText();
  const pattern = /\b[A-Z]{2,}\b/g;
  let m: RegExpExecArray | null;

  let problems = 0;
  const diagnostics: Diagnostic[] = [];
  while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
    problems++;
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(m.index),
        end: textDocument.positionAt(m.index + m[0].length),
      },
      message: `${m[0]} is all uppercase.`,
      source: 'ex',
    };
    if (hasDiagnosticRelatedInformationCapability) {
      diagnostic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: 'Spelling matters',
        },
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: 'Particularly for names',
        },
      ];
    }
    diagnostics.push(diagnostic);
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
  // update cached variables
  _change.changes.forEach((change) => {
    const filePath = uriToPath(change.uri);
    if (filePath) {
      const content = fs.readFileSync(filePath, 'utf8');
      parseCSSVariablesFromText({
        content,
        filePath,
      });
    }
  });
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.

    const doc = documents.get(_textDocumentPosition.textDocument.uri);

    if (!doc) {
      return [];
    }

    const offset = doc.offsetAt(_textDocumentPosition.position);
    const currentWord = getCurrentWord(doc, offset);

    const isFunctionCall = isInFunctionExpression(currentWord);
    const editRange = Range.create(
      Position.create(
        _textDocumentPosition.position.line,
        _textDocumentPosition.position.character - currentWord.length - 2
      ),
      _textDocumentPosition.position
    );

    const items: CompletionItem[] = [];
    cachedVariables['all'].forEach((variable) => {
      const insertText = isFunctionCall ? variable.name : `var(${variable.name})`;
      const completion: CompletionItem = {
        label: variable.name,
        detail: variable.value,
        documentation: variable.value,
        insertText,
        // textEdit: TextEdit.replace(editRange, insertText),
        kind: isColor(variable.value)
          ? CompletionItemKind.Color
          : CompletionItemKind.Variable,
          sortText: 'z'
      };

      if (isFunctionCall) {
        completion.detail = variable.value;
      }

      items.push(completion);
    });

    console.log('completion', items);
    return items;

    // return [
    //   {
    //     label: 'TypeScript',
    //     kind: CompletionItemKind.Text,
    //     data: 1,
    //   },
    //   {
    //     label: 'JavaScript',
    //     kind: CompletionItemKind.Text,
    //     data: 2,
    //   },
    // ];
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  // if (item.data === 1) {
  //   item.detail = 'TypeScript details';
  //   item.documentation = 'TypeScript documentation';
  // } else if (item.data === 2) {
  //   item.detail = 'JavaScript details';
  //   item.documentation = 'JavaScript documentation';
  // }
  return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
