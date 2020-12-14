/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as postcss from 'postcss'
import * as isColor from 'is-color'

enum ValueKind {
  COLOR,
  OTHER,
}

const getValueKind = (str: string): ValueKind => {
  if (isColor(str)) {
    return ValueKind.COLOR
  }

  return ValueKind.OTHER
}

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
          const content = fs.readFileSync(path.join(folderPath, relativePath), {
            encoding: 'utf8',
          })

          const parsedCSS = postcss.parse(content)

          parsedCSS.walkDecls((decl) => {
            if (decl.prop.startsWith('--')) {
              console.log(decl.prop)
              const variable = decl.prop
              const completion = new vscode.CompletionItem(variable)

              completion.kind = vscode.CompletionItemKind.Variable
              completion.documentation = decl.value

              completion.detail = decl.value

              if (previousStr === '--') {
                completion.insertText = variable.substring(2)
              } else if (previousStr === 'r(') {
                completion.insertText = variable
              } else {
                completion.insertText = `var(${variable})`
              }

              if (getValueKind(decl.value) === ValueKind.COLOR) {
                completion.kind = vscode.CompletionItemKind.Color
              }

              colors.push(completion)
            }
          })
        })

        return colors
      },
    }
  )

  context.subscriptions.push(provider1)
}
