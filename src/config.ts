import { workspace } from "vscode";

import type { LensConfig } from "./types";

export function getConfig(): LensConfig {
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
      objectProperties: config.get<boolean>("preview.objectProperties", true),
      commentMaxLength: config.get<number>("preview.commentMaxLength", 80),
    },
    tags: {
      foldClosing: config.get<boolean>("tags.foldClosing", true),
      keepFirstLineAttributes: config.get<boolean>("tags.keepFirstLineAttributes", true),
    },
    comments: {
      foldable: config.get<boolean>("comments.foldable", true),
    },
  };
}
