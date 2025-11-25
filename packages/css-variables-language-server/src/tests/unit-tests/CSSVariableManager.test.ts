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
  // After resolution, --carousel-bg should have a color property
  expect(allVars.get('--carousel-bg').color).toBeDefined();
  expect(allVars.get('--carousel-bg').color).toEqual(allVars.get('--main-bg-color').color);

  expect(allVars.get('--child-main-bg-color').symbol.value).toEqual('brown');
  expect(allVars.get('--child-h1').symbol.value).toEqual('26px');
  expect(allVars.get('--child-h2').symbol.value).toEqual('22px');
  expect(allVars.get('--child-h3').symbol.value).toEqual('18px');
  // expect(allVars.get('--child-text-base').symbol.value).toEqual('16px');
  expect(allVars.get('--child-carousel-bg').symbol.value).toEqual(
    'var(--main-bg-color)'
  );
  // After resolution, --child-carousel-bg should have a color property
  expect(allVars.get('--child-carousel-bg').color).toBeDefined();
  expect(allVars.get('--child-carousel-bg').color).toEqual(allVars.get('--main-bg-color').color);

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

  test('can resolve nested variable references and detect colors', async () => {
    const cssManager = new CSSVariableManager();

    await cssManager.parseAndSyncVariables([
      path.join(__dirname, '../fixtures/nested-var-resolution'),
    ]);

    const allVars = cssManager.getAll();

    // Test direct color values
    expect(allVars.get('--color-red').symbol.value).toEqual('rgb(255, 0, 0)');
    expect(allVars.get('--color-red').color).toBeDefined();

    expect(allVars.get('--color-blue').symbol.value).toEqual('#0000ff');
    expect(allVars.get('--color-blue').color).toBeDefined();

    expect(allVars.get('--color-green').symbol.value).toEqual('hsl(120, 100%, 50%)');
    expect(allVars.get('--color-green').color).toBeDefined();

    // Test single-level nesting - value is still var() but should have color property
    expect(allVars.get('--color-red-alias').symbol.value).toEqual('var(--color-red)');
    expect(allVars.get('--color-red-alias').color).toBeDefined();
    expect(allVars.get('--color-red-alias').color).toEqual(allVars.get('--color-red').color);

    expect(allVars.get('--color-blue-alias').symbol.value).toEqual('var(--color-blue)');
    expect(allVars.get('--color-blue-alias').color).toBeDefined();
    expect(allVars.get('--color-blue-alias').color).toEqual(allVars.get('--color-blue').color);

    // Test two-level nesting
    expect(allVars.get('--color-red-alias-2').symbol.value).toEqual('var(--color-red-alias)');
    expect(allVars.get('--color-red-alias-2').color).toBeDefined();
    expect(allVars.get('--color-red-alias-2').color).toEqual(allVars.get('--color-red').color);

    // Test three-level nesting
    expect(allVars.get('--color-red-alias-3').symbol.value).toEqual('var(--color-red-alias-2)');
    expect(allVars.get('--color-red-alias-3').color).toBeDefined();
    expect(allVars.get('--color-red-alias-3').color).toEqual(allVars.get('--color-red').color);

    // Test four-level nesting
    expect(allVars.get('--color-red-alias-4').symbol.value).toEqual('var(--color-red-alias-3)');
    expect(allVars.get('--color-red-alias-4').color).toBeDefined();
    expect(allVars.get('--color-red-alias-4').color).toEqual(allVars.get('--color-red').color);

    // Test five-level nesting (max depth)
    expect(allVars.get('--color-red-alias-5').symbol.value).toEqual('var(--color-red-alias-4)');
    expect(allVars.get('--color-red-alias-5').color).toBeDefined();
    expect(allVars.get('--color-red-alias-5').color).toEqual(allVars.get('--color-red').color);

    // Test six-level nesting (should stop at depth 5, cannot resolve to a color)
    expect(allVars.get('--color-red-alias-6').symbol.value).toEqual('var(--color-red-alias-5)');
    // At 6 levels, we hit the depth limit and cannot fully resolve, so no color
    expect(allVars.get('--color-red-alias-6').color).toBeUndefined();

    // Test fallback values
    expect(allVars.get('--undefined-with-fallback').symbol.value).toEqual('var(--does-not-exist, #ff00ff)');
    expect(allVars.get('--undefined-with-fallback').color).toBeDefined();

    expect(allVars.get('--nested-with-fallback').symbol.value).toEqual('var(--also-undefined, var(--color-green))');
    expect(allVars.get('--nested-with-fallback').color).toBeDefined();
    expect(allVars.get('--nested-with-fallback').color).toEqual(allVars.get('--color-green').color);

    // Test circular references (should not have color)
    expect(allVars.get('--circular-a').symbol.value).toEqual('var(--circular-b)');
    expect(allVars.get('--circular-a').color).toBeUndefined();

    expect(allVars.get('--circular-b').symbol.value).toEqual('var(--circular-a)');
    expect(allVars.get('--circular-b').color).toBeUndefined();

    // Test non-color variables (should not have color)
    expect(allVars.get('--spacing').symbol.value).toEqual('16px');
    expect(allVars.get('--spacing').color).toBeUndefined();

    expect(allVars.get('--font-size').symbol.value).toEqual('14px');
    expect(allVars.get('--font-size').color).toBeUndefined();

    expect(allVars.get('--font').symbol.value).toEqual("700 14px/16px 'Helvetica Neue', sans-serif");
    expect(allVars.get('--font').color).toBeUndefined();

    // Test cross-file resolution
    expect(allVars.get('--child-color-red').symbol.value).toEqual('var(--color-red)');
    expect(allVars.get('--child-color-red').color).toBeDefined();
    expect(allVars.get('--child-color-red').color).toEqual(allVars.get('--color-red').color);

    expect(allVars.get('--child-color-blue-alias').symbol.value).toEqual('var(--color-blue-alias)');
    expect(allVars.get('--child-color-blue-alias').color).toBeDefined();
    expect(allVars.get('--child-color-blue-alias').color).toEqual(allVars.get('--color-blue').color);

    expect(allVars.get('--child-nested').symbol.value).toEqual('var(--color-red-alias-3)');
    expect(allVars.get('--child-nested').color).toBeDefined();
    expect(allVars.get('--child-nested').color).toEqual(allVars.get('--color-red').color);
  });
});
