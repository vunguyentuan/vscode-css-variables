/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

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

        const variableRegex = /[;\s]--([a-zA-Z-\d]+):/g
        const getVariables = async (line: string) => {
          const result = line.match(variableRegex)

          if (result) {
            result.forEach((str) => {
              const variable = str.slice(1, str.length - 1)
              const completion = new vscode.CompletionItem(variable)

              completion.kind = vscode.CompletionItemKind.Variable
              completion.documentation = 'ahiahi'

              if (previousStr === '--') {
                completion.insertText = variable.substring(2)
              } else if (previousStr === 'r(') {
                completion.insertText = variable
              } else {
                completion.insertText = `var(${variable})`
              }
              colors.push(completion)
            })
          }
        }

        filesToLookup.forEach((relativePath) => {
          const content = fs.readFileSync(path.join(folderPath, relativePath), {
            encoding: 'utf8',
          })

          getVariables(content)
        })

        return colors
      },
    }
  )

  context.subscriptions.push(provider1)
}
