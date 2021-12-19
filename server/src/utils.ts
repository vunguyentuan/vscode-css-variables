import isColor from './utils/isColor';
import {
  CompletionItem,
  CompletionItemKind,
} from 'vscode-languageserver/node';


export enum ValueKind {
  COLOR,
  OTHER,
}

export const getValueKind = (str: string): ValueKind => {
  if (isColor(str)) {
    return ValueKind.COLOR;
  }

  return ValueKind.OTHER;
};

export const createCompletionItem = (
  propertyName: string,
  propertyValue: string
) => {
  const variable = propertyName;
  const fullVar = `var(${variable})`;
  const completion: CompletionItem = {
    label: fullVar,
  };

  completion.kind = CompletionItemKind.Variable;
  completion.documentation = propertyValue;

  completion.detail = propertyValue;

  if (getValueKind(propertyValue) === ValueKind.COLOR) {
    completion.kind = CompletionItemKind.Color;
  }

  return completion;
};
