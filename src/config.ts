import { workspace } from "vscode";

export function getConfig() {
  const config = workspace.getConfiguration("foldingLens");
  return {
    brackets: {
      foldClosing: config.get<boolean>("brackets.foldClosing", true),
    },
    preview: {
      lineCount: config.get<boolean>("preview.lineCount", true),
      brackets: config.get<boolean>("preview.brackets", true),
      functionParams: config.get<boolean>("preview.functionParams", true),
      chaining: config.get<boolean>("preview.chaining", true),
      commentMaxLength: Math.max(6, Math.floor(config.get<number>("preview.commentMaxLength", 80))),
    },
    comments: {
      foldable: config.get<boolean>("comments.foldable", true),
    },
  };
}
