# vscode-css-variables

## 2.8.1

### Patch Changes

- efd2ef0: Fix bundler configuration

## 2.8.0

### Minor Changes

- 55146ab: Add support for nested CSS variable color resolution. Variables that reference other variables using `var()` now display color previews correctly.

  Features:

  - Resolves nested variable references up to 5 levels deep
  - Supports fallback values: `var(--undefined, blue)`
  - Detects and handles circular references
  - Works across multiple files
  - Maintains backward compatibility

  Example:

  ```css
  :root {
    --color: rgb(0, 0, 0);
    --color-alias: var(--color); /* Now shows color preview! */
  }
  ```

  Add support for OKLAB and OKLCH color spaces by upgrading Culori to v4. Modern CSS color formats are now fully supported.

  Example:

  ```css
  :root {
    --oklab-color: oklab(0.628 0.225 0.126);
    --oklch-color: oklch(0.628 0.258 29.2);
    --with-alpha: oklch(0.628 0.258 29.2 / 0.8);
  }
  ```

## 2.7.1

### Patch Changes

- ee114b1: Fixed settings to only contribute this extension to files with specified languages

## 2.6.5

### Patch Changes

- d887de0: Added setting to configure languages the extension should provide suggestions

## 2.6.3

### Patch Changes

- d7effa1: remove badges as it broken

## 2.6.2

### Patch Changes

- a36efd0: Ignore .next & .cache folders, reorder alphabetically

## 2.6.1

### Patch Changes

- b3c7d68: update activated documents, avoid trigger autocomplete on irrelevant files

## 2.6.0

### Minor Changes

- 211fe35: Fix SASS and LESS parser
  Bump version to 2.4.3

## 2.4.2

### Patch Changes

- e85c564: Minify bundle

## 2.4.0

### Minor Changes

- 6a56298: Support TailwindCSS, reduce extension size, impove load time by 10x, use monorepo
