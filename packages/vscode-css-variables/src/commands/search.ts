import { window } from "vscode";
import { LanguageClient, CompletionItem } from "vscode-languageclient/node";

export default async function search(client: LanguageClient) {
  const editor = window.activeTextEditor;

  // 获取当前选择的文本
  const selectedText = editor?.document.getText(editor.selection)?.trim() ?? "";
  // 将颜色值或简单文本作为搜索依据
  const defaultInput = /^(#[0-9A-Fa-f]{3,6})$|^[\w-]+$/.test(selectedText)
    ? selectedText
    : "";
  const input = await window.showInputBox({
    value: defaultInput,
    prompt: "Enter the CSS variable name or value to search",
  });
  if (!input) {
    return;
  }

  // 向 language server 发送请求，获取选项数据
  const options: CompletionItem[] = await client.sendRequest("search", input);

  // 如果没有查询到数据，就返回
  if (options.length === 0) {
    window.showInformationMessage(`No css variable found for '${input}'`);
    return;
  }

  // 弹出命令选项，将选项数据提供给用户选择
  const selectedOption = await window.showQuickPick(options);
  if (selectedOption && editor) {
    editor.edit((edit) => {
      edit.replace(editor.selection, selectedOption.insertText);
    });
  }
}
