import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Range,
  ColorInformation,
} from 'vscode-languageserver/node';

import * as fs from 'fs';
import * as path from 'path';
import {
  getCSSLanguageService,
  getLESSLanguageService,
  getSCSSLanguageService,
  Location,
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

type CSSSymbol = {
  name: string
  value: string
  node: any
}

type CSSVariable = {
  symbol: CSSSymbol
  definition: Location
  color?: ColorInformation
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

  while (
    right <= text.length &&
    ' \t\n\r":{[()]},*>+'.indexOf(text.charAt(right)) === -1
  ) {
    right++;
  }

  return text.substring(left, right);
}

function isInFunctionExpression(word: string): boolean {
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

    const document = TextDocument.create(
      `file://${filePath}`,
      'css',
      0,
      content
    );

    const stylesheet = service.parseStylesheet(document);

    const symbolContext = new Symbols(stylesheet);

    const documentColors = service.findDocumentColors(document, stylesheet);

    console.log(documentColors);

    const result: ColorInformation[] = []
    ;(stylesheet as any).accept((node: any) => {
      console.log('node', node);
      return true;
    });

    symbolContext.global.symbols.forEach((symbol: CSSSymbol) => {
      if (symbol.name.startsWith('--')) {
        if (!cachedVariables[filePath]) {
          cachedVariables[filePath] = new Map();
        }
        if (!cachedVariables['all']) {
          cachedVariables['all'] = new Map();
        }

        console.log(symbol);

        const variable: CSSVariable = {
          symbol,
          definition: {
            uri: filePath,
            range: Range.create(
              document.positionAt(symbol.node.offset),
              document.positionAt(symbol.node.end)
            ),
          },
        };

        // add to cache
        cachedVariables['all'].set(symbol.name, variable);
        cachedVariables[filePath].set(symbol.name, variable);
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
  // const settings = await getDocumentSettings(textDocument.uri);

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
      definitionProvider: true,
      colorProvider: true,
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
    const doc = documents.get(_textDocumentPosition.textDocument.uri);

    if (!doc) {
      return [];
    }

    const offset = doc.offsetAt(_textDocumentPosition.position);
    const currentWord = getCurrentWord(doc, offset);

    const isFunctionCall = isInFunctionExpression(currentWord);

    const items: CompletionItem[] = [];
    cachedVariables['all'].forEach((variable) => {
      const varSymbol = variable.symbol;
      const insertText = isFunctionCall
        ? varSymbol.name
        : `var(${varSymbol.name})`;
      const completion: CompletionItem = {
        label: varSymbol.name,
        detail: varSymbol.value,
        documentation: varSymbol.value,
        insertText,
        // textEdit: TextEdit.replace(editRange, insertText),
        kind: isColor(varSymbol.value)
          ? CompletionItemKind.Color
          : CompletionItemKind.Variable,
        sortText: 'z',
      };

      if (isFunctionCall) {
        completion.detail = varSymbol.value;
      }

      items.push(completion);
    });

    return items;
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.onDocumentColor((params): ColorInformation[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const colors: ColorInformation[] = [];

  // cachedVariables['all'].forEach(variable => {
  //     const color = Color.parse(variable.value);
  //     const range = document.getWordRangeAtPosition(
  //         document.positionAt(variable.value),
  //         /\b[A-Z]{2,}\b/g
  //     );
  //     return {
  //         color,
  //         range,
  //     };
  // }

  console.log("on document color");

  return colors;
});

connection.onDefinition((params) => {
  const doc = documents.get(params.textDocument.uri);

  if (!doc) {
    return null;
  }

  const offset = doc.offsetAt(params.position);
  const currentWord = getCurrentWord(doc, offset);

  if (!currentWord)
    return null;

  const nornalizedWord = currentWord.slice(1);

  const definition = null;
  const cssVariable = cachedVariables['all'].get(nornalizedWord);

  if (cssVariable) {
    return cssVariable.definition;
  }

  return definition;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
