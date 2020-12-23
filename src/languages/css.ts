import * as postcss from 'postcss'
import { CompletionItem } from 'vscode'
import { createCompletionItem } from '../utils'

const processContent = (
  content: string,
  output: Array<CompletionItem>,
  previousStr: string
) => {
  const parsedCSS = postcss.parse(content)

  parsedCSS.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) {
      const propertyName = decl.prop
      const propertyValue = decl.value
      output.push(
        createCompletionItem(propertyName, propertyValue, previousStr)
      )
    }
  })
}

export default processContent
