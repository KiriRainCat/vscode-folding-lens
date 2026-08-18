import type { TextEditor } from "vscode";

export class FoldState {
  private readonly cache = new WeakMap<TextEditor, Set<number>>();

  update(editor: TextEditor): void {
    const visible = editor.visibleRanges;
    if (visible.length === 0) return;

    const current = visible.slice(0, -1).map((r) => r.end.line);
    let folded = this.cache.get(editor);
    if (!folded || folded.size === 0) {
      this.cache.set(editor, new Set(current));
      return;
    }

    for (const line of current) folded.add(line);

    const foldedNow = new Set(current);
    const firstVisible = visible[0]!.start.line;
    const lastVisible = visible[visible.length - 1]!.end.line;
    for (const line of folded) {
      if (line >= firstVisible && line < lastVisible && !foldedNow.has(line)) folded.delete(line);
    }
  }

  isFolded(editor: TextEditor, range: { start: number; end: number }): boolean {
    const folded = this.cache.get(editor);
    if (folded?.has(range.start)) return true;
    return this.atEndOfDocument(editor, range);
  }

  // VSCode reports no visibleRanges gap when the fold ends at the last line of the document
  private atEndOfDocument(editor: TextEditor, range: { start: number; end: number }): boolean {
    const lastLine = editor.document.lineCount - 1;
    if (range.end < lastLine - 1) return false;
    const visible = editor.visibleRanges;
    if (visible.length === 0) return false;
    const lastVisible = visible[visible.length - 1]!.end.line;
    if (lastVisible <= range.start) {
      this.cache.get(editor)?.add(range.start);
      return true;
    }
    return false;
  }
}
