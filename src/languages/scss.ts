import * as scssParser from 'scss-parser'
import * as createQueryWrapper from 'query-ast'

import { CompletionItem } from 'vscode'
import { createCompletionItem } from '../utils'

const processContent = (
  content: string,
  output: Array<CompletionItem>,
  previousStr: string
) => {
  const ast = scssParser.parse(content)
  let $ = createQueryWrapper(ast)

  $('declaration').nodes.forEach((node: any) => {
    const propertyName = $(node).find('property').value()
    const propertyValue = $(node).find('value').value()

    if (propertyName.startsWith('--')) {
      output.push(
        createCompletionItem(propertyName, propertyValue, previousStr)
      )
    }
  })
}

export default processContent
