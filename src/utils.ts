import * as isColor from 'is-color'
import * as vscode from 'vscode'

export enum ValueKind {
  COLOR,
  OTHER,
}

export const getValueKind = (str: string): ValueKind => {
  if (isColor(str)) {
    return ValueKind.COLOR
  }

  return ValueKind.OTHER
}

export const createCompletionItem = (
  propertyName: string,
  propertyValue: string,
  previousStr: string
) => {
  const variable = propertyName
  const variableWithoutDash = variable.substring(2)
  const completion = new vscode.CompletionItem(variable)

  // completion.sortText = variableWithoutDash
  completion.filterText = variableWithoutDash
  completion.kind = vscode.CompletionItemKind.Variable
  completion.documentation = propertyValue

  completion.detail = propertyValue

  if (previousStr === '--') {
    completion.insertText = variableWithoutDash
  } else if (previousStr === 'r(') {
    completion.insertText = variable
  } else {
    completion.insertText = `var(${variable})`
  }

  if (getValueKind(propertyValue) === ValueKind.COLOR) {
    completion.kind = vscode.CompletionItemKind.Color
  }
  return completion
}