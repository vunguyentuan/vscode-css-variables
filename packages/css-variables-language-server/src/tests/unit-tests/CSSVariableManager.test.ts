import CSSVariableManager, { CSSVariable } from '../../CSSVariableManager';
import * as path from 'path';

async function runTest(
  fixturePath: string,
  additionalChecks?: (vars: Map<string, CSSVariable>) => void
) {
  const cssManager = new CSSVariableManager();

  await cssManager.parseAndSyncVariables([path.join(__dirname, fixturePath)]);

  const allVars = cssManager.getAll();

  expect(allVars.get('--main-bg-color').symbol.value).toEqual('brown');
  expect(allVars.get('--h1').symbol.value).toEqual('26px');
  expect(allVars.get('--h2').symbol.value).toEqual('22px');
  expect(allVars.get('--h3').symbol.value).toEqual('18px');
  expect(allVars.get('--text-base').symbol.value).toEqual('16px');
  expect(allVars.get('--carousel-bg').symbol.value).toEqual(
    'var(--main-bg-color)'
  );
  expect(allVars.get('--child-main-bg-color').symbol.value).toEqual('brown');
  expect(allVars.get('--child-h1').symbol.value).toEqual('26px');
  expect(allVars.get('--child-h2').symbol.value).toEqual('22px');
  expect(allVars.get('--child-h3').symbol.value).toEqual('18px');
  // expect(allVars.get('--child-text-base').symbol.value).toEqual('16px');
  expect(allVars.get('--child-carousel-bg').symbol.value).toEqual(
    'var(--main-bg-color)'
  );

  if (typeof additionalChecks === 'function') {
    await additionalChecks(allVars);
  }
}

describe('CSS Variable Manager', () => {
  test('can parse variables from css files', async () => {
    await runTest('../fixtures/css-nested');
  });

  test('can parse variables from less files', async () => {
    await runTest('../fixtures/less-nested');
  });

  test('can parse variables from scss files', async () => {
    await runTest('../fixtures/scss-nested');
  });

  test('can parse variables from mixed files', async () => {
    await runTest('../fixtures/mixed-nested');
  });

  test('can parse variables from tailwind @layer', async () => {
    await runTest('../fixtures/tailwindcss-nested');
  });

  test('can parse variables from remote url', async () => {
    await runTest('../fixtures/import-url', (allVars) => {
      expect(allVars.get('--slate-50').symbol.value).toEqual('#f8fafc');
    });
  });
});
