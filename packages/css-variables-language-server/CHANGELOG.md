# css-variables-language-server

## 2.8.2

### Patch Changes

- 2ad8e41: Prevent crashing when css variables have unexpected format such as `--font: var(--font-size)/var(--line-height);`

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

## 2.7.2

### Patch Changes

- 66d4b53: Fixed LSP message pollution by URL fetch failures

## 2.7.0

### Minor Changes

- 3a5bfa9: Add executable for language server to run from the commandline.

  ```sh
  $ npm install -g css-variables-language-server
  $ css-variables-language-server --stdio
  ```

## 2.6.4

### Patch Changes

- f380403: feat: 52 support for color functional notation
  fix: excessive highlighting when hovering over variable

## 2.6.2

### Patch Changes

- a36efd0: Ignore .next & .cache folders, reorder alphabetically

## 2.6.1

### Patch Changes

- 50a631d: remove commit characters as it confuse some users

## 2.5.0

### Minor Changes

- 1eedbba: use postcss-sass and postcss-less to parse the relevant files

## 2.4.1

### Patch Changes

- 0bdec05: Fix go to definition

## 2.4.0

### Minor Changes

- 6a56298: Support TailwindCSS, reduce extension size, impove load time by 10x, use monorepo
