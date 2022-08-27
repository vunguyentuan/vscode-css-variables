export function isInFunctionExpression(word: string): boolean {
  if (word.length < 1) {
    return false;
  }

  return '(' === word.charAt(0);
}
