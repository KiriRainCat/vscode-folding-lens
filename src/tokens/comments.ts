import type { DocLike, FoldRange, LensConfig, Tok, TokLine } from "@/types";

export function buildCommentRanges(lines: readonly TokLine[], doc: DocLike, cfg: LensConfig): FoldRange[] {
  if (!cfg.comments.foldable) return [];

  const ranges: FoldRange[] = [];
  let block: { start: number; end: number } | null = null;
  let lineGroup: { start: number; end: number; style: string } | null = null;

  const flushBlock = () => {
    if (block && block.end > block.start) {
      // keep the '/**' marker as real text (native highlighting); the preview
      // only replaces the rest, synthesizing the hidden '*/' terminator
      const marker = /^\s*(\/\*+[!*]?)/.exec(doc.lineAt(block.start).text);
      const startColumn = marker ? marker[0].length : firstNonWhitespace(doc, block.start);
      const core = blockPreview(doc, block.start, block.end, cfg.comments.previewMaxLength);
      ranges.push({
        start: block.start,
        end: block.end,
        kind: "comment",
        startColumn,
        collapsedText: truncate(` ${core} ⋯ */`, cfg.comments.previewMaxLength),
      });
    }
    block = null;
  };

  const flushLineGroup = () => {
    if (lineGroup && lineGroup.end > lineGroup.start) {
      // keep the line-comment marker ('//', '#', ...) as real text
      const marker = /^\s*([^\w\s'"`]+)/.exec(doc.lineAt(lineGroup.start).text);
      const startColumn = marker ? marker[0].length : firstNonWhitespace(doc, lineGroup.start);
      const core = linePreview(doc, lineGroup.start, cfg.comments.previewMaxLength);
      ranges.push({
        start: lineGroup.start,
        end: lineGroup.end,
        kind: "comment",
        startColumn,
        collapsedText: ` ${core}`,
      });
    }
    lineGroup = null;
  };

  for (let line = 0; line < lines.length; line++) {
    const leading = leadingCommentStyle(doc, line, lines[line]?.tokens ?? []);

    if (leading?.startsWith("comment.block")) {
      flushLineGroup();
      if (block) block.end = line;
      else block = { start: line, end: line };
    } else if (leading) {
      flushBlock();
      if (lineGroup && lineGroup.style === leading && lineGroup.end === line - 1) {
        lineGroup.end = line;
      } else {
        flushLineGroup();
        lineGroup = { start: line, end: line, style: leading };
      }
    } else {
      flushBlock();
      flushLineGroup();
    }
  }

  flushBlock();
  flushLineGroup();
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

function linePreview(doc: DocLike, start: number, maxLength: number): string {
  const text = doc.lineAt(start).text.trimStart();
  const stripped = text.replace(/^([^\w\s'"`]+)\s*/, "");
  return truncate(stripped.length > 0 ? stripped : text, maxLength);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, Math.max(0, maxLength - 1)).trimEnd() + "…";
}
