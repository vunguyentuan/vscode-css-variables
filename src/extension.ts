/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

import processCSSContent from './languages/css'
import processSCSSContent from './languages/scss'
import processLESSContent from './languages/less'

export function activate(context: vscode.ExtensionContext) {
  const provider1 = vscode.languages.registerCompletionItemProvider(
    [
      'typescriptreact',
      'javascriptreact',
      'vue',
      'vue-html',
      'vue-postcss',
      'css',
      'scss',
      'less',
    ],
    {
      async provideCompletionItems(document, position, token, context) {
        const workspaceFolder = vscode.workspace.workspaceFolders || []
        const config = vscode.workspace.getConfiguration('cssVariables')
        const filesToLookup = (config.get('lookupFiles') || []) as string[]
        const folderPath = workspaceFolder[0].uri.toString().split(':')[1]
        const colors: vscode.CompletionItem[] = []

        const lastCharPos = new vscode.Position(
          position.line,
          Math.max(position.character - 2, 0)
        )

        const previousStr = document.getText(
          new vscode.Range(lastCharPos, position)
        )

        filesToLookup.forEach((relativePath) => {
          const fileExtension = path.extname(relativePath)

          const content = fs.readFileSync(path.join(folderPath, relativePath), {
            encoding: 'utf8',
          })

          switch (fileExtension) {
            case '.css':
              processCSSContent(content, colors, previousStr)
              break
            case '.scss':
              processSCSSContent(content, colors, previousStr)
              break
            case '.less':
              processLESSContent(content, colors, previousStr)
              break
          }
        })

        return colors
      },
    }
  )

  context.subscriptions.push(provider1)
}
