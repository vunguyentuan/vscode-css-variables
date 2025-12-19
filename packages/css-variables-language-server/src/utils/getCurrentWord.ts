import { TextDocument } from 'vscode-languageserver-textdocument';

export interface WordInfo {
  word: string;
  left: number;
  right: number;
}

export function getCurrentWordInfo(document: TextDocument, offset: number): WordInfo {
  let left = offset - 1;
  let right = offset;
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

  return {
    word: text.substring(left, right),
    left,
    right
  };
}

export function getCurrentWord(document: TextDocument, offset: number): string {
  return getCurrentWordInfo(document, offset).word;
}
