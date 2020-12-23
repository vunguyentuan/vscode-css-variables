import { CompletionItem } from 'vscode'
import { createCompletionItem } from '../utils'
import * as less from 'less'

const processContent = async (
  content: string,
  output: Array<CompletionItem>,
  previousStr: string
) => {
  const parsedCSS = await less.parse(content)

  // parsedCSS.walkDecls((decl) => {
  //   if (decl.prop.startsWith('--')) {
  //     const propertyName = decl.prop
  //     const propertyValue = decl.value
  //     output.push(
  //       createCompletionItem(propertyName, propertyValue, previousStr)
  //     )
  //   }
  // })
}

export default processContent
