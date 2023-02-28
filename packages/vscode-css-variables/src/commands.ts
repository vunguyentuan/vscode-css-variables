import { commands, ExtensionContext, window } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import search from "./commands/search";

export const commandsMap = {
  "vscode-css-variables.search": search,
};

export default function registerCommands(
  context: ExtensionContext,
  client: LanguageClient
) {
  Object.entries(commandsMap).forEach(([name, command]) => {
    context.subscriptions.push(
      commands.registerCommand(name, () => command(client))
    );
  });
}
