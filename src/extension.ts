/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

import { CompletionItem } from 'vscode'
import { createCompletionItem } from './utils'
import {
  getCSSLanguageService,
  getLESSLanguageService,
  getSCSSLanguageService,
  TextDocument,
} from 'vscode-css-languageservice'
import { Symbols } from 'vscode-css-languageservice/lib/umd/parser/cssSymbolScope.js'
const appDir = '/.vscode/';
const appDirBCK = '\\.vscode\\';
const appFile = 'settings.json';

interface doCompleteProps {
  content: string
  output: Array<CompletionItem>
  previousStr: string
  fileExtension: string
}

const getLanguageService = (fileExtension: string) => {
  switch (fileExtension) {
    case '.less':
      return getLESSLanguageService
    case '.scss':
      return getSCSSLanguageService
    default:
      return getCSSLanguageService
  }
}

const doComplete = ({
  content,
  output,
  previousStr,
  fileExtension,
}: doCompleteProps) => {
  try {
    const languageService = getLanguageService(fileExtension)
    const service = languageService()

    const styleSheet = service.parseStylesheet(
      TextDocument.create('test://test/test.css', 'css', 0, content)
    )

    const symbolContext = new Symbols(styleSheet)

    symbolContext.global.symbols.forEach((symbol: any) => {
      if (symbol.name.startsWith('--')) {
        output.push(
          createCompletionItem(symbol.name, symbol.value, previousStr)
        )
      }
    })
  } catch (error) { }
}

export function activate(context: vscode.ExtensionContext) {

  let disposable = vscode.commands.registerCommand('css-variable-snippets.createImporter', () => {
    const WKfolder = vscode.workspace.workspaceFolders;
    if (WKfolder === undefined) {
      vscode.window.showInformationMessage('Please open a project folder first.')
      return;
    }
    WKfolder.map(item => {
      if (fs.existsSync(item.uri.fsPath + appDir + appFile)) {
        vscode.workspace.openTextDocument(item.uri.fsPath + appDirBCK + appFile).then(doc => {
          vscode.window.showTextDocument(doc)
          vscode.window.showInformationMessage('Opening configuration file.');
        })
      } else {
        if (!fs.existsSync(item.uri.fsPath + appDir)) {
          fs.mkdir(item.uri.fsPath + appDir, { recursive: true }, (err) => {
            if (err) throw err;

            var data = '{' +
              '\n\t"cssVariables.lookupFiles": [' +
              '\n\t\t"src/theme/axians.scss"' +
              '\n\t]' +
              '\n}';

            fs.writeFile(item.uri.fsPath + appDir + appFile, data, function (err) {
              if (err) {
                vscode.window.showInformationMessage('Permission error!');
                return console.log(err);
              }
              vscode.workspace.openTextDocument(item.uri.fsPath + appDirBCK + appFile).then(doc => {
                vscode.window.showTextDocument(doc)
                vscode.window.showInformationMessage('Configuration file successfuly generated.');
              })
            });

          })
          return
        }
      }
    })
  });

  const provider1 = vscode.languages.registerCompletionItemProvider(
    ['vue', 'vue-html', 'vue-postcss', 'css', 'scss', 'less'],
    {
      async provideCompletionItems(document, position, token, context) {
        const workspaceFolder = vscode.workspace.workspaceFolders || []
        const config = vscode.workspace.getConfiguration('cssVariables')
        const filesToLookup = (config.get('lookupFiles') || []) as string[]
        const folderPath = workspaceFolder[0].uri.fsPath
        const colors: vscode.CompletionItem[] = []

        const lastCharPos = new vscode.Position(
          position.line,
          0
          // Math.max(position.character - 2, 0)
        )

        const previousStr = document.getText(
          new vscode.Range(lastCharPos, position)
        )

        filesToLookup.forEach((relativePath) => {
          const fileExtension = path.extname(relativePath)

          const content = fs.readFileSync(path.join(folderPath, relativePath), {
            encoding: 'utf8',
          })

          doComplete({ content, output: colors, previousStr, fileExtension })
        })

        // console.log(colors);

        return colors
      },
    }
  )

  context.subscriptions.push(provider1)
}
