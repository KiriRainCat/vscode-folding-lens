import type { DocLike, FoldRange, LensConfig, Tok, TokLine } from "@/types";

/**
 * Block comments only: the preview (summary + synthesized close-comment
 * terminator) is the lens feature. Line-comment groups are left to VS Code's
 * own providers — emitting nothing there means no same-start conflict, so
 * native folding survives.
 */
export function buildCommentRanges(lines: readonly TokLine[], doc: DocLike, cfg: LensConfig): FoldRange[] {
  if (!cfg.comments.foldable) return [];

  const ranges: FoldRange[] = [];
  let block: { start: number; end: number } | null = null;

  const flushBlock = () => {
    if (block && block.end > block.start) {
      // keep the '/**' marker as real text (native highlighting); the preview
      // only replaces the rest, synthesizing the hidden close-comment marker
      const marker = /^\s*(\/\*+[!*]?)/.exec(doc.lineAt(block.start).text);
      const startColumn = marker ? marker[0].length : firstNonWhitespace(doc, block.start);
      const core = blockPreview(doc, block.start, block.end, cfg.preview.commentMaxLength);
      ranges.push({
        start: block.start,
        end: block.end,
        kind: "comment",
        startColumn,
        collapsedText: truncate(` ${core} ⋯ */`, cfg.preview.commentMaxLength),
      });
    }
    block = null;
  };

  for (let line = 0; line < lines.length; line++) {
    if (leadingCommentStyle(doc, line, lines[line]?.tokens ?? [])?.startsWith("comment.block")) {
      if (block) block.end = line;
      else block = { start: line, end: line };
    } else {
      flushBlock();
    }
  }

  flushBlock();
  return ranges;
}

function leadingCommentStyle(doc: DocLike, line: number, tokens: readonly Tok[]): string | null {
  const firstNonWs = firstNonWhitespace(doc, line);
  for (const tok of tokens) {
    // skip tokens entirely before the first non-whitespace char;
    // a whole-line token (common in TM grammars) starts at 0 and must not be skipped
    if (tok.end <= firstNonWs) continue;
    const scope = tok.scopes.find((s) => s.startsWith("comment."));
    return scope ?? null;
  }
  return null;
}

function firstNonWhitespace(doc: DocLike, line: number): number {
  const text = doc.lineAt(line).text;
  const match = /\S/.exec(text);
  return match ? match.index : text.length;
}

function blockPreview(doc: DocLike, start: number, end: number, maxLength: number): string {
  const firstLine = doc.lineAt(start).text.replace(/^\s*\/\*+[*/!]?\s*/, "");
  if (firstLine.trim().length > 0) return truncate(firstLine.trim(), maxLength);

  for (let line = start + 1; line <= end; line++) {
    const content = doc.lineAt(line).text.trim();
    if (content.length === 0 || content.startsWith("*/") || /^\*+\*\/?$/.test(content)) continue;
    const stripped = content
      .replace(/^\/\*+/, "")
      .replace(/^\*+\s?/, "")
      .replace(/\*\/$/, "")
      .trim();
    if (stripped.length === 0) continue;
    return truncate(stripped, maxLength);
  }
  return "…";
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, Math.max(0, maxLength - 1)).trimEnd() + "…";
}
