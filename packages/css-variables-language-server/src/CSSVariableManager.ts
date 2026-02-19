import { Range, Color, Location, Position } from 'vscode-languageserver/node';
import * as fs from 'fs';
import fastGlob from 'fast-glob';
import * as culori from 'culori';
import axios from 'axios';
import postcss from 'postcss';
import { pathToFileURL } from 'url';
import path from 'path';
import postcssSCSS from 'postcss-scss';
import postcssLESS from 'postcss-less';
import CacheManager from './CacheManager';
import isColor from './utils/isColor';
import { culoriColorToVscodeColor } from './utils/culoriColorToVscodeColor';
import { resolveVariableValue } from './utils/resolveVariableValue';

export type CSSSymbol = {
  name: string
  value: string
}

export type CSSVariable = {
  symbol: CSSSymbol
  definition: Location
  color?: Color
}

export type CSSCustomMedia = {
  name: string
  params: string
  definition: Location
}

export interface CSSVariablesSettings {
  lookupFiles: string[]
  blacklistFolders: string[]
  /**
   * When enabled the language server will index `@custom-media` rules and
   * expose them for completion/hover/definition requests.
   */
  enableCustomMedia?: boolean
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
export const defaultSettings: CSSVariablesSettings = {
  lookupFiles: ['**/*.less', '**/*.scss', '**/*.sass', '**/*.css'],
  blacklistFolders: [
    '**/.cache',
    '**/.DS_Store',
    '**/.git',
    '**/.hg',
    '**/.next',
    '**/.svn',
    '**/bower_components',
    '**/CVS',
    '**/dist',
    '**/node_modules',
    '**/tests',
    '**/tmp',
  ],
  enableCustomMedia: false,
};

const getAST = (filePath: string, content: string) => {
  const fileExtension = path.extname(filePath);

  if (fileExtension === '.less') {
    return postcssLESS.parse(content);
  }
  
  if (fileExtension === '.scss') {
    return postcssSCSS.parse(content);
  }

  return postcss.parse(content);
};

export default class CSSVariableManager {
  private cacheManager = new CacheManager<CSSVariable>();
  private customMediaCache = new CacheManager<CSSCustomMedia>();

  public parseCSSVariablesFromText = async ({
    content,
    filePath,
    settings,
  }: {
    content: string
    filePath: string
    settings: CSSVariablesSettings
  }) => {
    try {
      // reset cache for this file
      this.cacheManager.clearFileCache(filePath);
      this.customMediaCache.clearFileCache(filePath);

      const ast = getAST(filePath, content);
      const fileURI = pathToFileURL(filePath).toString();

      const importUrls = [];
      ast.walkAtRules((atRule) => {
        if (atRule.name === 'import') {
          // only support absolute url for now
          const match = atRule.params.match(
            /['"](?<protocol>http|https):\/\/(?<url>.*?)['"]/
          );

          if (match) {
            const url = `${match.groups.protocol}://${match.groups.url}`;

            importUrls.push(url);
          }
        }
      });

      await Promise.all(
        importUrls.map(async (url) => {
          try {
            const response = await axios(url, {
              responseType: 'text',
            });

            const cssText = await response.data;

            return this.parseCSSVariablesFromText({
              content: cssText,
              filePath: url,
              settings,
            });
          } catch (err) {
            console.error(err, `cannot fetch data from ${url}`);
          }
        })
      );

      // parse variables declarations
      ast.walkDecls((decl) => {
        if (decl.prop.startsWith('--')) {
          const variable: CSSVariable = {
            symbol: {
              name: decl.prop,
              value: decl.value,
            },
            definition: {
              uri: fileURI,
              range: Range.create(
                Position.create(
                  decl.source.start.line - 1,
                  decl.source.start.column - 1
                ),
                Position.create(
                  decl.source.end.line - 1,
                  decl.source.end.column - 1
                )
              ),
            },
          };

          let culoriColor: culori.Color | undefined;
          try {
            culoriColor = culori.parse(decl.value);
          } catch (error) {
            // If culori cannot parse the value, it's not a color
            // This is expected for non-color values like font definitions
          }

          if (culoriColor) {
            variable.color = culoriColorToVscodeColor(culoriColor);
          }

          // add to cache
          this.cacheManager.set(filePath, decl.prop, variable);
        }
      });

      // parse custom-media rules and cache them.
      if (settings.enableCustomMedia) {
        ast.walkAtRules((atRule) => {
          if (atRule.name === 'custom-media') {
            // params format: "--name <media-query>"
            const match = atRule.params.match(/^(--[\w-]+)\s+(.*)$/);
            if (match) {
              const cm: CSSCustomMedia = {
                name: match[1],
                params: match[2],
                definition: {
                  uri: fileURI,
                  range: Range.create(
                    Position.create(
                      atRule.source.start.line - 1,
                      atRule.source.start.column - 1
                    ),
                    Position.create(
                      atRule.source.end.line - 1,
                      atRule.source.end.column - 1
                    )
                  ),
                },
              };
              this.customMediaCache.set(filePath, cm.name, cm);
            }
          }
        });
      }
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
    }
  };

  public parseAndSyncVariables = async (
    workspaceFolders: string[],
    settings: CSSVariablesSettings = defaultSettings
  ) => {
    for (const folderPath of workspaceFolders) {
      await fastGlob(settings.lookupFiles, {
        onlyFiles: true,
        cwd: folderPath,
        ignore: settings.blacklistFolders,
        absolute: true,
      }).then((files) => {
        return Promise.all(
          files.map((filePath) => {
            const content = fs.readFileSync(filePath, 'utf8');
            return this.parseCSSVariablesFromText({
              content,
              filePath,
              settings,
            });
          })
        );
      });
    }

    // After all files are parsed, resolve nested variable references
    this.resolveAllVariableReferences();
  };

  /**
   * Resolves nested variable references (var(--name)) for all cached variables
   * and updates their color property if the resolved value is a color
   */
  private resolveAllVariableReferences() {
    const allVariables = this.cacheManager.getAll();

    // Iterate through all variables and resolve their values
    allVariables.forEach((cssVariable, varName) => {
      const originalValue = cssVariable.symbol.value;

      // Skip if already has a color (direct color value)
      if (cssVariable.color) {
        return;
      }

      // Try to resolve any var() references
      const resolvedValue = resolveVariableValue(originalValue, allVariables);

      // If the value was resolved (changed), try to parse it as a color
      if (resolvedValue !== originalValue) {
        let culoriColor: culori.Color;

        try {
          // Culori will throw on some invalid variables, we should not crash the server
          culoriColor = culori.parse(resolvedValue);
        } catch {
          // If culori cannot parse the resolved value, it's not a color
          return;
        }

        if (culoriColor) {
          // Update the color property for this variable
          cssVariable.color = culoriColorToVscodeColor(culoriColor);
        }
      }
    });
  }

  public getAll() {
    return this.cacheManager.getAll();
  }

  public clearFileCache(filePath: string) {
    this.cacheManager.clearFileCache(filePath);
    this.customMediaCache.clearFileCache(filePath);
  }

  public clearAllCache() {
    this.cacheManager.clearAllCache();
    this.customMediaCache.clearAllCache();
  }

  public getAllCustomMedia() {
    return this.customMediaCache.getAll();
  }

  public getCustomMedia(name: string) {
    return this.customMediaCache.get(name);
  }

  /**
   * Public method to trigger variable resolution
   * Should be called after parsing files to resolve nested variable references
   */
  public resolveVariableReferences() {
    this.resolveAllVariableReferences();
  }
}
