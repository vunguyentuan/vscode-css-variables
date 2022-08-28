import { TextDocument } from 'vscode-languageserver-textdocument';

export function getCurrentWord(document: TextDocument, offset: number): string {
  let left = offset - 1;
  let right = offset + 1;
  const text = document.getText();

  while (left >= 0 && ' \t\n\r":{[()]},*>+'.indexOf(text.charAt(left)) === -1) {
    left--;
  }

  while (
    right <= text.length &&
    ' \t\n\r":{[()]},*>+'.indexOf(text.charAt(right)) === -1
  ) {
    right++;
  }

  return text.substring(left, right);
}
