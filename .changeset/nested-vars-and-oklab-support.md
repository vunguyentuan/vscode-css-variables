---
"css-variables-language-server": minor
"vscode-css-variables": minor
---

Add support for nested CSS variable color resolution. Variables that reference other variables using `var()` now display color previews correctly.

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
