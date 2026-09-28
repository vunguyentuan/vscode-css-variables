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
  ColorInformation,
  FileChangeType,
  Hover,
  TextEdit,
} from 'vscode-languageserver/node';
import * as fs from 'fs';
import fastGlob from 'fast-glob';
import micromatch from 'micromatch';
import * as path from 'path';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import isColor from './utils/isColor';
import { uriToPath } from './utils/protocol';
import { findAll } from './utils/findAll';
import { indexToPosition } from './utils/indexToPosition';
import { getCurrentWord, getCurrentWordInfo } from './utils/getCurrentWord';
import { isInFunctionExpression } from './utils/isInFunctionExpression';
import CSSVariableManager, { CSSVariablesSettings, defaultSettings } from './CSSVariableManager';
import { formatHex } from 'culori';

// The client's file watchers (**/*.css, **/*.scss, **/*.sass, **/*.less) are
// registered workspace-wide and are unaware of both cssVariables.lookupFiles
// and cssVariables.blacklistFolders - only the initial fast-glob scan uses
// them. Re-derive the same inclusion decision here so live edits behave
// exactly like fastGlob(lookupFiles, { ignore: blacklistFolders, cwd }):
// dynamic glob patterns are subject to the blacklist, but an explicit static
// file path in lookupFiles always matches regardless of the blacklist
// (verified directly against fast-glob - it never applies `ignore` to
// non-dynamic patterns, since those are resolved as plain existence checks).
const isIncludedFile = (
  filePath: string,
  lookupFiles: string[],
  blacklistFolders: string[],
  workspaceFolders: string[]
): boolean => {
  const ignorePatterns = blacklistFolders.flatMap((pattern) => [pattern, `${pattern}/**`]);
  const isBlacklisted = micromatch.isMatch(filePath, ignorePatterns, { dot: true });

  return workspaceFolders.some((folderPath) =>
    lookupFiles.some((pattern) =>
      fastGlob.isDynamicPattern(pattern)
        ? !isBlacklisted && micromatch.isMatch(filePath, path.join(folderPath, pattern), { dot: true })
        : path.resolve(folderPath, pattern) === filePath
    )
  );
};

// A single fs event burst (e.g. git checkout, pnpm install) can arrive as many
// back-to-back onDidChangeWatchedFiles notifications. Each resolve pass walks
// every cached variable in the workspace, so coalesce bursts into one pass.
let resolveDebounceTimer: ReturnType<typeof setTimeout> | undefined;
const scheduleResolveVariableReferences = (manager: CSSVariableManager) => {
  if (resolveDebounceTimer) {
    clearTimeout(resolveDebounceTimer);
  }
  resolveDebounceTimer = setTimeout(() => {
    manager.resolveVariableReferences();
  }, 300);
};

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const cssVariableManager = new CSSVariableManager();

connection.onInitialize(async (params: InitializeParams) => {
  const capabilities = params.capabilities;

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
      hoverProvider: true,
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

connection.onInitialized(async () => {
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

  const workspaceFolders = await connection.workspace.getWorkspaceFolders();
  const validFolders = workspaceFolders
    ?.map((folder) => uriToPath(folder.uri) || '')
    .filter((path) => !!path);

  const settings = await getDocumentSettings();
  lastCssVariablesSettingsSnapshot = JSON.stringify(settings);

  // parse and sync variables
  cssVariableManager.parseAndSyncVariables(validFolders || [], settings);
});

let globalSettings = defaultSettings;

// workspace/didChangeConfiguration fires for ANY VS Code setting change, not
// just cssVariables.*, so only re-scan the whole workspace when the
// cssVariables settings themselves actually changed.
let lastCssVariablesSettingsSnapshot: string | undefined;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<CSSVariablesSettings>> = new Map();

connection.onDidChangeConfiguration(async (change) => {
  if (hasConfigurationCapability) {
    // Reset cached document settings so we re-fetch from the client, then
    // check whether cssVariables settings actually changed before paying
    // for a full cache clear + workspace re-scan.
    documentSettings.clear();

    const settings = await getDocumentSettings();
    const settingsSnapshot = JSON.stringify(settings);

    if (settingsSnapshot === lastCssVariablesSettingsSnapshot) {
      return;
    }
    lastCssVariablesSettingsSnapshot = settingsSnapshot;

    cssVariableManager.clearAllCache();

    const validFolders = await connection.workspace
      .getWorkspaceFolders()
      .then((folders) =>
        folders
          ?.map((folder) => uriToPath(folder.uri) || '')
          .filter((path) => !!path)
      );

    // parse and sync variables
    cssVariableManager.parseAndSyncVariables(validFolders || [], settings);
  } else {
    globalSettings = <CSSVariablesSettings>(
      (change.settings?.cssVariables || defaultSettings)
    );
  }
});

function getDocumentSettings(): Thenable<CSSVariablesSettings> {
  const resource = 'all';
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration('cssVariables');
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  connection.console.log('Closed: ' + e.document.uri);
  documentSettings.delete(e.document.uri);
});

connection.onDidChangeWatchedFiles(async (_change) => {
  const settings = await getDocumentSettings();
  const workspaceFolders = await connection.workspace
    .getWorkspaceFolders()
    .then((folders) => folders?.map((folder) => uriToPath(folder.uri) || '').filter((p) => !!p) || []);

  const relevantChanges = _change.changes.filter((change) => {
    const filePath = uriToPath(change.uri);
    return !!filePath && isIncludedFile(filePath, settings.lookupFiles, settings.blacklistFolders, workspaceFolders);
  });

  if (relevantChanges.length === 0) {
    return;
  }

  // update cached variables
  await Promise.all(
    relevantChanges.map(async (change) => {
      const filePath = uriToPath(change.uri);
      // remove variables from cache
      if (change.type === FileChangeType.Deleted) {
        cssVariableManager.clearFileCache(filePath);
      } else {
        const content = fs.readFileSync(filePath, 'utf8');
        await cssVariableManager.parseCSSVariablesFromText({
          content,
          filePath,
        });
      }
    })
  );

  // After all file changes are processed, resolve variable references
  scheduleResolveVariableReferences(cssVariableManager);
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const doc = documents.get(_textDocumentPosition.textDocument.uri);
    if (!doc) {
      return [];
    }

    const offset = doc.offsetAt(_textDocumentPosition.position);
    const wordInfo = getCurrentWordInfo(doc, offset);
    const currentWord = wordInfo.word;

    const isFunctionCall = isInFunctionExpression(currentWord);

    const items: CompletionItem[] = [];
    cssVariableManager.getAll().forEach((variable) => {
      const varSymbol = variable.symbol;
      const insertText = isFunctionCall
        ? varSymbol.name
        : `var(${varSymbol.name})`;

      const start = doc.positionAt(wordInfo.left + 1);
      const end = doc.positionAt(wordInfo.right);
      const range = { start, end };

      const completion: CompletionItem = {
        label: varSymbol.name,
        detail: varSymbol.value,
        documentation: varSymbol.value,
        insertText,
        textEdit: TextEdit.replace(range, insertText),
        kind: isColor(varSymbol.value)
          ? CompletionItemKind.Color
          : CompletionItemKind.Variable,
        sortText: varSymbol.name.replace(/(.*?)(\d+)$/, (_, label, num) => label + num.padStart(4, '0'))
      };

      if (isColor(varSymbol.value)) {
        // convert to hex code
        completion.documentation = formatHex(varSymbol.value);
      }

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

  const text = document.getText();
  const matches = findAll(/var\((?<varName>--[a-z-0-9]+)/g, text);

  const globalStart: Position = { line: 0, character: 0 };

  matches.map((match) => {
    const start = indexToPosition(text, match.index + 4);
    const end = indexToPosition(text, match.index + match[0].length);

    const cssVariable = cssVariableManager.getAll().get(match.groups.varName);

    if (cssVariable?.color) {
      const range = {
        start: {
          line: globalStart.line + start.line,
          character:
            (end.line === 0 ? globalStart.character : 0) + start.character,
        },
        end: {
          line: globalStart.line + end.line,
          character:
            (end.line === 0 ? globalStart.character : 0) + end.character,
        },
      };

      colors.push({
        color: cssVariable.color,
        range,
      });
    }
  });

  return colors;
});

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);

  if (!doc) {
    return null;
  }

  const offset = doc.offsetAt(params.position);
  const currentWord = getCurrentWord(doc, offset);

  if (!currentWord) return null;

  const nornalizedWord = currentWord.slice(1);

  const cssVariable = cssVariableManager.getAll().get(nornalizedWord);

  if (cssVariable) {
    return {
      contents: cssVariable.symbol.value,
    } as Hover;
  }

  return null;
});

connection.onColorPresentation((params) => {
  const document = documents.get(params.textDocument.uri);

  const className = document.getText(params.range);
  if (!className) {
    return [];
  }

  return [];
});

connection.onDefinition((params) => {
  const doc = documents.get(params.textDocument.uri);

  if (!doc) {
    return null;
  }

  const offset = doc.offsetAt(params.position);
  const currentWord = getCurrentWord(doc, offset);

  if (!currentWord) return null;

  const nornalizedWord = currentWord.slice(1);
  const cssVariable = cssVariableManager.getAll().get(nornalizedWord);

  if (cssVariable) {
    return cssVariable.definition;
  }

  return null;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
