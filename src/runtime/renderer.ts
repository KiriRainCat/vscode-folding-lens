import type { FoldingService } from "./service";
import type { FoldRange } from "@/types";
import type { DecorationOptions, Disposable, TextEditor, TextEditorDecorationType } from "vscode";

import { Range, ThemeColor, window } from "vscode";

const DEBOUNCE_MS = 150;

export class Renderer implements Disposable {
  private readonly deco: TextEditorDecorationType;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.deco.dispose();
  }

  schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      for (const editor of window.visibleTextEditors) void this.updateNow(editor);
    }, DEBOUNCE_MS);
  }

  constructor(private readonly service: FoldingService) {
    this.deco = window.createTextEditorDecorationType({
      // zero-width instead of display:none: the hidden range's offsets stay in
      // the layout, so clicks right of the preview still map to the line end
      textDecoration: "none; font-size: 0;",
      before: {
        color: new ThemeColor("editorCodeLens.foreground"),
      },
    });
  }

  async updateNow(editor: TextEditor): Promise<void> {
    const version = editor.document.version;
    const ranges = this.service.rangesSync(editor.document) ?? (await this.service.ranges(editor.document));
    if (this.disposed || editor.document.version !== version) return;
    this.apply(editor, ranges);
  }

  private apply(editor: TextEditor, ranges: readonly FoldRange[]): void {
    const doc = editor.document;
    const options: DecorationOptions[] = [];
    const visible = editor.visibleRanges;
    const gaps = new Map<number, number>();

    for (let i = 1; i < visible.length; i++) {
      const start = visible[i - 1]!.end.line;
      const end = visible[i]!.start.line - 1;
      if (end > start) gaps.set(start, end);
    }

    const lastLine = doc.lineCount - 1;
    const emptyLastLine = doc.lineAt(lastLine).text.length === 0;
    const lastVisibleLine = visible.at(-1)?.end.line;

    for (const range of ranges) {
      // VS Code omits the zero-length visible range of a lone trailing empty line.
      // Require the fold header itself to be visible, not merely somewhere below the viewport.
      const beforeEmptyLastLine = emptyLastLine && range.end === lastLine - 1 && range.start === lastVisibleLine;
      if (gaps.get(range.start) !== range.end && !beforeEmptyLastLine) continue;

      const lineLength = doc.lineAt(range.start).text.length;
      const column = Math.min(range.startColumn ?? lineLength, lineLength);

      options.push({
        range: new Range(range.start, column, range.start, lineLength),
        renderOptions: { before: { contentText: leadingNbsp(range.collapsedText) } },
      });
    }
    editor.setDecorations(this.deco, options);
  }
}

// a leading regular space in injected ::before content is collapsed by the editor's
// whitespace processing; NBSP survives it
function leadingNbsp(text: string): string {
  return text.startsWith(" ") ? `\u00A0${text.slice(1)}` : text;
}
