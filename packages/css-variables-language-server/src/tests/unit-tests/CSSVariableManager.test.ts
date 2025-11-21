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

  test('can parse and detect OKLAB and OKLCH colors', async () => {
    const cssManager = new CSSVariableManager();

    await cssManager.parseAndSyncVariables([
      path.join(__dirname, '../fixtures/oklab-oklch-colors'),
    ]);

    const allVars = cssManager.getAll();

    // Test OKLAB colors
    const oklabRed = allVars.get('--oklab-red');
    expect(oklabRed.symbol.value).toEqual('oklab(0.628 0.225 0.126)');
    expect(oklabRed.color).toBeDefined();

    const oklabGreen = allVars.get('--oklab-green');
    expect(oklabGreen.symbol.value).toEqual('oklab(0.519 -0.14 0.108)');
    expect(oklabGreen.color).toBeDefined();

    const oklabBlue = allVars.get('--oklab-blue');
    expect(oklabBlue.symbol.value).toEqual('oklab(0.452 -0.032 -0.312)');
    expect(oklabBlue.color).toBeDefined();

    const oklabWithAlpha = allVars.get('--oklab-with-alpha');
    expect(oklabWithAlpha.symbol.value).toEqual('oklab(0.628 0.225 0.126 / 0.5)');
    expect(oklabWithAlpha.color).toBeDefined();

    // Test OKLCH colors
    const oklchRed = allVars.get('--oklch-red');
    expect(oklchRed.symbol.value).toEqual('oklch(0.628 0.258 29.2)');
    expect(oklchRed.color).toBeDefined();

    const oklchGreen = allVars.get('--oklch-green');
    expect(oklchGreen.symbol.value).toEqual('oklch(0.519 0.177 142.5)');
    expect(oklchGreen.color).toBeDefined();

    const oklchBlue = allVars.get('--oklch-blue');
    expect(oklchBlue.symbol.value).toEqual('oklch(0.452 0.313 264.1)');
    expect(oklchBlue.color).toBeDefined();

    const oklchWithAlpha = allVars.get('--oklch-with-alpha');
    expect(oklchWithAlpha.symbol.value).toEqual('oklch(0.628 0.258 29.2 / 0.8)');
    expect(oklchWithAlpha.color).toBeDefined();

    // Verify non-color variables don't have color property
    const h1Var = allVars.get('--h1');
    expect(h1Var.symbol.value).toEqual('26px');
    expect(h1Var.color).toBeUndefined();
  });
});
