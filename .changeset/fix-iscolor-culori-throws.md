---
"css-variables-language-server": patch
---

Fix completion list being truncated when a CSS variable value causes `culori.parse` to throw. Variables with complex `background` shorthand values (e.g. containing `linear-gradient()`) triggered an unhandled exception in `isColor`, aborting the completion loop early and dropping all subsequent variables from suggestions.
