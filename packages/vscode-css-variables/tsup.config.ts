import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['cjs'],
  external: ['vscode'],
  // Bundle all dependencies for VS Code extension
  // By default, tsup externalizes "dependencies" (designed for library publishing)
  // But VS Code extensions need self-contained bundles (no npm install after .vsix install)
  // See: https://github.com/egoist/tsup/issues/619
  //
  // We explicitly list dependencies (not devDependencies) that need bundling:
  // - Language server packages (vscode-languageserver*) used by server.ts
  // - Parser/utility packages (postcss, culori, etc.) used by language server
  // - vscode-languageclient is in devDependencies and external (has vscode imports)
  noExternal: [
    'css-variables-language-server',
    'vscode-languageserver',
    'vscode-languageserver-textdocument',
    'vscode-uri',
    'axios',
    'culori',
    'fast-glob',
    'less',
    'line-column',
    'postcss',
    'postcss-less',
    'postcss-scss',
    'sass',
  ],
  minify: true,
  bundle: true,
  splitting: false,
  clean: true,
});
