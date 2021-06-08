[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/vunguyentuan.vscode-css-variables.svg)](https://marketplace.visualstudio.com/items?itemName=vunguyentuan.vscode-css-variables)
[![Version](https://vsmarketplacebadge.apphb.com/version/vunguyentuan.vscode-css-variables.svg)](https://marketplace.visualstudio.com/items?itemName=vunguyentuan.vscode-css-variables)
[![Rating](https://vsmarketplacebadge.apphb.com/rating-star/vunguyentuan.vscode-css-variables.svg)](https://marketplace.visualstudio.com/items?itemName=vunguyentuan.vscode-css-variables)

# Credits

This is an extension originaly created by vunguyentuan.

# Functionality

- Support CSS/SCSS/LESS/POSTCSS syntax.
- Provide autocomplete feature for css variables.
- Color preview

You need to provide your css that contains variables definition.

![Demo](https://github.com/vunguyentuan/vscode-css-variables/raw/master/demo.gif)

# Quick Usage

Windows users: press `CTRL + SHIFT + P`, than search for "Global CSS Autocomplete", it will generate the config file where your specific css stylesheets can be listed for autocompletion.

# Manual Configuration

.vscode/settings.json

```json
{
  "cssVariables.lookupFiles": [
    "node_modules/common-ui/dist/CommonUIVariable.css",
    "assets/styles/variables.css"
  ]
}
```
