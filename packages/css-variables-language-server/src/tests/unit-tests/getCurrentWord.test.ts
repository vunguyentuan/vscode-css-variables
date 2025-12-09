
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getCurrentWord } from '../../utils/getCurrentWord';

describe('getCurrentWord', () => {
  it('should return word including delimiter at start', () => {
    const text = 'var(--color)';
    const document = TextDocument.create('test.css', 'css', 1, text);
    // offset at end of --color
    // v:0, a:1, r:2, (:3, -:4, -:5, c:6, ... r:10, ):11
    // offset 11 (before ))
    const word = getCurrentWord(document, 11);
    expect(word).toBe('(--color');
  });

  it('should handle cursor at delimiter', () => {
    const text = 'var(--)';
    const document = TextDocument.create('test.css', 'css', 1, text);
    // v:0, a:1, r:2, (:3, -:4, -:5, ):6
    // offset 6 (at ))
    const word = getCurrentWord(document, 6);
    expect(word).toBe('(--');
  });
});
