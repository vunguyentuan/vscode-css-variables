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

  test('Completes in css file', async () => {
    // ensure custom media feature is off for this first assertion
    await vscode.workspace.getConfiguration().update('cssVariables.enableCustomMedia', false, vscode.ConfigurationTarget.Workspace);
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

  test('Completes custom media when enabled', async () => {
    await vscode.workspace.getConfiguration().update('cssVariables.enableCustomMedia', true, vscode.ConfigurationTarget.Workspace);
    await testCompletion(docUri, '@media (--^', {
      items: [
        {
          label: '--small-viewport',
          kind: vscode.CompletionItemKind.Variable,
        },
      ],
      notItems: [
        {
          label: '--chakra-ring-offset-width',
        },
        {
          label: '--chakra-ring-color',
        },
      ],
    });
  });

  test('Completes custom media even when closing parenthesis already present', async () => {
    await vscode.workspace.getConfiguration().update('cssVariables.enableCustomMedia', true, vscode.ConfigurationTarget.Workspace);
    await testCompletion(docUri, '@media (--)^', {
      items: [
        {
          label: '--small-viewport',
          kind: vscode.CompletionItemKind.Variable,
        },
      ],
      notItems: [
        {
          label: '--chakra-ring-offset-width',
        },
        {
          label: '--chakra-ring-color',
        },
      ],
    });
  });

  test('does not suggest custom media outside @media', async () => {
    await vscode.workspace.getConfiguration().update('cssVariables.enableCustomMedia', true, vscode.ConfigurationTarget.Workspace);
    await testCompletion(docUri, 'color: -^', {
      items: [
        // the previously expected variable entries, but no --small-viewport
        {
          label: '--chakra-ring-offset-width',
          kind: vscode.CompletionItemKind.Variable,
        },
        {
          label: '--chakra-ring-color',
          kind: vscode.CompletionItemKind.Color,
        },
      ],
      // ensure our custom media item is absent
      notItems: [
        {
          label: '--small-viewport',
        },
      ],
    });
  });

  test('Hover/definition for custom media', async () => {
    await vscode.workspace.getConfiguration().update('cssVariables.enableCustomMedia', true, vscode.ConfigurationTarget.Workspace);
    await activate(docUri);

    // hover
    let pos = positionOf('@media (--small-viewport^');
    let hover = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', docUri, pos);
    assert.ok(hover && hover.length > 0);
    assert.ok(hover[0].contents.some((c) => typeof c === 'string' ? c.includes('(max-width: 30em)') : false));

    // definition
    pos = positionOf('@media (--small-viewport^');
    const defs = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', docUri, pos);
    assert.ok(defs && defs.length > 0);
    assert.strictEqual(defs[0].uri.fsPath.endsWith('test.css'), true);
  });
});

interface Expectation {
  items: Array<{ label: string; kind?: vscode.CompletionItemKind }>;
  notItems?: Array<{ label: string }>;
}

async function testCompletion(
  docUri: vscode.Uri,
  searchText: string,
  expectedCompletionList: vscode.CompletionList & Expectation,
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

    assert.ok(actualItem, `Expected completion ${expectedItem.label} was not present`);
    assert.strictEqual(actualItem.label, expectedItem.label);
    assert.strictEqual(actualItem.kind, expectedItem.kind);
  });

  if (expectedCompletionList.notItems) {
    expectedCompletionList.notItems.forEach((not) => {
      const found = actualCompletionList.items.find((item) => {
        if (typeof item.label === 'string') {
          return item.label === not.label;
        }
        return false;
      });
      assert.strictEqual(found, undefined, `Did not expect completion ${not.label}`);
    });
  }
}
