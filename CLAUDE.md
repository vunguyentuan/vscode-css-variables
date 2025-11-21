# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that provides CSS variable autocomplete, color preview, and go-to-definition functionality. The extension scans CSS/SCSS/SASS/LESS files in the workspace and provides intelligent suggestions for CSS custom properties (variables starting with `--`).

## Monorepo Structure

This is a Turborepo monorepo with two packages:

- **`packages/vscode-css-variables`**: The VS Code extension client that activates the language server and handles VS Code integration
- **`packages/css-variables-language-server`**: The Language Server Protocol (LSP) implementation that powers the extension's core functionality

## Common Commands

### Build
```bash
npm run build      # Build all packages using Turbo
```

### Development
```bash
npm run dev        # Watch mode for all packages
```

### Testing
```bash
npm run test       # Run tests for all packages
npm run lint       # Lint all packages
```

### Testing Single Package
```bash
cd packages/vscode-css-variables && npm test       # Test extension only
cd packages/css-variables-language-server && npm test  # Test language server only
```

### Package & Deploy
```bash
npm run package    # Package the extension (creates .vsix file)
npm run deploy     # Deploy to VS Code marketplace
npm run release    # Build and publish to npm (uses changesets)
```

### Version Management with Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management. GitHub Actions automatically handle version bumping and releases.

**IMPORTANT: Never run `changeset version` manually!** GitHub Actions will handle this.

#### Adding a Changeset

When you make changes that require a version bump:

1. **Create a changeset file manually** (non-interactive):
   ```bash
   # Create a file in .changeset/ with a descriptive name
   # Example: .changeset/add-nested-variables.md
   ```

2. **Changeset file format**:
   ```markdown
   ---
   "css-variables-language-server": minor
   "vscode-css-variables": minor
   ---

   Description of your changes.

   - Feature 1
   - Feature 2

   Example code if needed.
   ```

3. **Commit only the changeset file**:
   ```bash
   git add .changeset/your-changeset.md
   git commit -m "add changeset for feature X"
   git push
   ```

4. **GitHub Actions will automatically**:
   - Detect the changeset
   - Create a "Version Packages" PR
   - Bump versions in package.json
   - Update CHANGELOG.md files
   - When the PR is merged, publish to npm and VS Code marketplace

**Version bump types**:
- `patch`: Bug fixes (2.7.2 → 2.7.3)
- `minor`: New features (2.7.2 → 2.8.0)
- `major`: Breaking changes (2.7.2 → 3.0.0)

## Architecture

### Language Server Pattern

The extension follows the Language Server Protocol architecture:

1. **Client (packages/vscode-css-variables/src/index.ts)**: Activates the extension and starts the language server via IPC. Reads `cssVariables.languages` configuration to determine which file types to support.

2. **Server (packages/css-variables-language-server/src/index.ts)**: The LSP server that handles:
   - `onCompletion`: Provides CSS variable autocomplete suggestions
   - `onDefinition`: Enables go-to-definition for CSS variables
   - `onHover`: Shows variable values on hover
   - `onDocumentColor`: Provides color preview/decoration
   - File watching: Monitors CSS/SCSS/SASS/LESS files for changes

### CSS Variable Management

**CSSVariableManager** (packages/css-variables-language-server/src/CSSVariableManager.ts) is the core class that:

- Scans workspace files based on `cssVariables.lookupFiles` glob patterns
- Parses CSS/SCSS/SASS/LESS files using PostCSS with appropriate syntax parsers
- Extracts CSS custom properties (declarations starting with `--`)
- Supports `@import` statements with absolute URLs (fetches remote CSS files)
- Detects color values using the `culori` library
- Stores variables in a cache organized by file path

### Cache Management

**CacheManager** (packages/css-variables-language-server/src/CacheManager.ts):

- Maintains two-level cache: per-file and global (all variables)
- When a file changes, clears only that file's cache and removes those variables from the global cache
- Supports incremental updates when files are added/modified/deleted

### CSS Parsing Strategy

The language server uses PostCSS with syntax-specific parsers:
- `.less` files → `postcss-less`
- `.scss` files → `postcss-scss`
- `.css` files → standard `postcss`

This allows parsing CSS variables from preprocessor files without requiring compilation.

## Configuration

Users can customize the extension via VS Code settings:

- `cssVariables.lookupFiles`: Glob patterns for files to scan (default: CSS/SCSS/SASS/LESS)
- `cssVariables.blacklistFolders`: Folders to ignore (default: node_modules, dist, etc.)
- `cssVariables.languages`: File types where autocomplete is active
- `cssVariables.trace.server`: LSP communication logging level

## Development Notes

### Working with the Extension

When debugging the extension:
1. Run `npm run dev` to start watch mode
2. Press F5 in VS Code to launch Extension Development Host
3. The language server runs on port 6009 in debug mode (see packages/vscode-css-variables/src/index.ts:24)

### Testing

- Extension tests are in `packages/vscode-css-variables/src/test/` and use the VS Code test framework
- Language server tests are in `packages/css-variables-language-server/src/tests/` and use Jest

### Adding New Features

When adding LSP capabilities:
1. Add the capability to `InitializeResult` in packages/css-variables-language-server/src/index.ts:57-68
2. Implement the corresponding `connection.on*` handler
3. Ensure CSSVariableManager provides the necessary data
4. Update configuration schema in packages/vscode-css-variables/package.json if settings are needed

### Remote CSS Support

The extension supports `@import` statements with HTTP/HTTPS URLs. When parsing CSS files, it:
1. Walks AST to find `@import` at-rules with URL schemes
2. Fetches remote CSS via axios
3. Recursively parses imported CSS for variables
4. Caches remote variables with the URL as the file path
