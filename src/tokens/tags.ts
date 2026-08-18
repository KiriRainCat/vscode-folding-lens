import type { DocLike, FoldRange, LensConfig, Tok, TokLine } from "@/types";

import { lineCountText, tokenText } from "./previews";

interface OpenTag {
  name: string;
  beginTok: Tok;
  beginIdx: number;
  gtTok: Tok | undefined;
  gtIdx: number | undefined;
}

export function buildTagRanges(lines: readonly TokLine[], doc: DocLike, cfg: LensConfig): FoldRange[] {
  const tokens = flatten(lines);
  const stack: OpenTag[] = [];
  const pairs: { open: OpenTag; closeGt: Tok }[] = [];

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i] as Tok;
    if (!isTagBegin(doc, tok)) {
      i++;
      continue;
    }

    const closing = tokenText(doc, tok).startsWith("</");
    const gtIdx = findTagEnd(tokens, i + 1);
    const gt = gtIdx >= 0 ? (tokens[gtIdx] as Tok) : undefined;
    const name = tagNameAt(tokens, i, doc);

    if (closing) {
      if (gt) matchAndPop(stack, name, gt, pairs);
    } else {
      const selfClosing = gt ? tokenText(doc, gt).startsWith("/") : false;
      if (!selfClosing) stack.push({ name, beginTok: tok, beginIdx: i, gtTok: gt, gtIdx });
    }

    i = gt ? gtIdx + 1 : i + 1;
  }

  const ranges: FoldRange[] = [];
  for (const { open, closeGt } of pairs) {
    const openGt = open.gtTok;
    const start = open.beginTok.line;
    const end = closeGt.line - (cfg.tags.foldClosing ? 0 : 1);
    if (start >= end) continue;

    const multilineOpen = openGt !== undefined && openGt.line !== open.beginTok.line;
    let startColumn: number | undefined;
    let prefix = "";

    if (cfg.tags.keepFirstLineAttributes) {
      if (multilineOpen) {
        startColumn = doc.lineAt(start).text.trimEnd().length;
        prefix = "…>";
      } else if (openGt) {
        startColumn = openGt.end;
      }
    } else {
      const nameEnd = nameEndOnBeginLine(tokens, open);
      const hasAttributes = openGt !== undefined && openGt.start > nameEnd;
      startColumn = hasAttributes || multilineOpen ? nameEnd : openGt?.end;
      prefix = hasAttributes || multilineOpen ? "…>" : "";
    }

    const core = cfg.preview.lineCount ? lineCountText(closeGt.line - start - 1) : "…";
    const suffix = cfg.tags.foldClosing ? `</${open.name}>` : "";
    ranges.push({ start, end, startColumn, collapsedText: prefix + core + suffix, kind: undefined });
  }

  return ranges;
}

function flatten(lines: readonly TokLine[]): Tok[] {
  const result: Tok[] = [];
  for (const { tokens } of lines) result.push(...tokens);
  return result;
}

function isTagBegin(doc: DocLike, tok: Tok): boolean {
  if (!tok.scopes.some((s) => s.startsWith("punctuation.definition.tag.begin"))) return false;
  return tokenText(doc, tok).startsWith("<");
}

function findTagEnd(tokens: readonly Tok[], from: number): number {
  for (let i = from; i < tokens.length && i - from < 200; i++) {
    const tok = tokens[i] as Tok;
    if (tok.scopes.some((s) => s.startsWith("punctuation.definition.tag.end"))) return i;
  }
  return -1;
}

function tagNameAt(tokens: readonly Tok[], beginIdx: number, doc: DocLike): string {
  const next = tokens[beginIdx + 1];
  if (next && next.scopes.some((s) => s.startsWith("entity.name.tag"))) return tokenText(doc, next);
  return "";
}

function nameEndOnBeginLine(tokens: readonly Tok[], open: OpenTag): number {
  const next = tokens[open.beginIdx + 1];
  if (next && next.line === open.beginTok.line && next.scopes.some((s) => s.startsWith("entity.name.tag"))) {
    return next.end;
  }
  return open.beginTok.end;
}

function matchAndPop(stack: OpenTag[], name: string, closeGt: Tok, pairs: { open: OpenTag; closeGt: Tok }[]): void {
  while (stack.length > 0) {
    const top = stack.pop();
    if (top && top.name === name) {
      pairs.push({ open: top, closeGt });
      return;
    }
  }
}
