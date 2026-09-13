import type { DocLike, FoldRange, LensConfig, TokLine } from "@/types";

export function buildCommentRanges(lines: readonly TokLine[], doc: DocLike, cfg: LensConfig): FoldRange[] {
  if (!cfg.comments.foldable) return [];

  const ranges: FoldRange[] = [];
  let block: { start: number; column: number; core: string } | undefined;

  for (let line = 0; line < lines.length; line++) {
    const text = doc.lineAt(line).text;
    let from = 0;

    if (!block) {
      const marker = /^\s*(\/\*+[!*]?)/.exec(text);
      if (!marker) continue;

      const column = text.indexOf("/*");
      const token = lines[line]!.tokens.find((t) => t.start <= column && t.end > column);
      if (!token?.scopes.some((s) => s.startsWith("comment.block"))) continue;

      block = { start: line, column: marker[0].length, core: "" };
      // Search from the actual opener so even /**/ is recognized as closed.
      from = column + 2;
    }

    const end = text.indexOf("*/", from);
    const closed =
      end >= 0 && lines[line]!.tokens.some((t) => t.start <= end && t.end > end && t.scopes.some((s) => s.startsWith("comment.block")));
    const content = text
      .slice(line === block.start ? block.column : 0, closed ? end : text.length)
      .replace(/^\s*\*?\s*/, "")
      .trim();

    if (!block.core && content) block.core = content;
    if (!closed) continue;

    if (line > block.start) {
      const core = block.core.slice(0, cfg.preview.commentMaxLength - 6).trimEnd();
      ranges.push({
        start: block.start,
        end: line,
        startColumn: block.column,
        collapsedText: core ? ` ${core} ⋯ */` : " ⋯ */",
        kind: "comment",
      });
    }

    block = undefined;
  }

  return ranges;
}
