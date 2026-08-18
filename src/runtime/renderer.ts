import { Range, ThemeColor, window } from "vscode";
import type { DecorationOptions, Disposable, TextEditor, TextEditorDecorationType } from "vscode";

import type { FoldRange } from "@/types";

import type { FoldingService } from "./service";
import type { FoldState } from "./state";

const DEBOUNCE_MS = 150;

export class Renderer implements Disposable {
  private readonly deco: TextEditorDecorationType;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly service: FoldingService,
    private readonly foldState: FoldState,
  ) {
    this.deco = window.createTextEditorDecorationType({
      // zero-width instead of display:none: the hidden range's offsets stay in
      // the layout, so clicks right of the preview still map to the line end
      textDecoration: "none; font-size: 0;",
      before: {
        color: new ThemeColor("editorCodeLens.foreground"),
      },
    });
  }

  schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      for (const editor of window.visibleTextEditors) void this.updateNow(editor);
    }, DEBOUNCE_MS);
  }

  async updateNow(editor: TextEditor): Promise<void> {
    const version = editor.document.version;
    const ranges = this.service.rangesSync(editor.document) ?? (await this.service.ranges(editor.document));
    if (editor.document.version !== version) return;
    this.apply(editor, ranges);
  }

  private apply(editor: TextEditor, ranges: readonly FoldRange[]): void {
    const doc = editor.document;
    const options: DecorationOptions[] = [];
    for (const range of ranges) {
      if (!this.foldState.isFolded(editor, range)) continue;
      const lineLength = doc.lineAt(range.start).text.length;
      const column = Math.min(range.startColumn ?? lineLength, lineLength);
      options.push({
        range: new Range(range.start, column, range.start, lineLength),
        renderOptions: { before: { contentText: leadingNbsp(range.collapsedText ?? "…") } },
      });
    }
    editor.setDecorations(this.deco, options);
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.deco.dispose();
  }
}

// a leading regular space in injected ::before content is collapsed by the editor's
// whitespace processing; NBSP survives it
function leadingNbsp(text: string): string {
  return text.startsWith(" ") ? `\u00A0${text.slice(1)}` : text;
}
