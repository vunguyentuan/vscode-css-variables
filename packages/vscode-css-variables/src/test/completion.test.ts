/* --------------------------------------------------------------------------------------------
 * Copyright (c) Vu Nguyen. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as assert from 'assert';
import {
  getDocUri,
  activate,
  positionOf,
} from './helper';

suite('Should do completion', () => {
  const docUri = getDocUri('test.css');

  test.only('Completes in css file', async () => {
    await testCompletion(docUri, 'color: -^', {
      items: [
        {
          label: '--chakra-ring-offset-width',
          kind: vscode.CompletionItemKind.Variable,
        },
        {
          label: '--chakra-ring-color',
          kind: vscode.CompletionItemKind.Color,
        },
      ],
    });
  });
});

async function testCompletion(
  docUri: vscode.Uri,
  searchText: string,
  expectedCompletionList: vscode.CompletionList,
) {
  await activate(docUri);

  const position = positionOf(searchText);
  const toPosition = position.with(position.line, position.character);

  // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
  const actualCompletionList = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider',
    docUri,
    toPosition,
  );

  expectedCompletionList.items.forEach((expectedItem) => {
    const actualItem = actualCompletionList.items.find((item) => {
      if (typeof item.label === 'string') {
        return item.label === expectedItem.label;
      }

      return false;
    });

    assert.ok(actualItem);
    assert.strictEqual(actualItem.label, expectedItem.label);
    assert.strictEqual(actualItem.kind, expectedItem.kind);
  });
}
