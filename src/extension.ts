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
  } catch (error) {}
}

export function activate(context: vscode.ExtensionContext) {
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

        console.log('trigger', previousStr, context)
        filesToLookup.forEach((relativePath) => {
          const fileExtension = path.extname(relativePath)

          const content = fs.readFileSync(path.join(folderPath, relativePath), {
            encoding: 'utf8',
          })

          doComplete({ content, output: colors, previousStr, fileExtension })
        })

        return colors
      },
    }
  )

  context.subscriptions.push(provider1)
}
