import type { DocLike, FoldRange, LensConfig, Tok, TokLine } from "../types";
import { functionParamsText, isObjectLiteral, lineCountText, objectPreviewText, tokenText } from "./previews";

const OPEN_TO_CLOSE: Record<string, string> = { "(": ")", "[": "]", "{": "}", "<": ">" };
const CLOSE_TO_OPEN: Record<string, string> = { ")": "(", "]": "[", "}": "{", ">": "<" };

interface BracketPair {
  open: Tok;
  close: Tok;
}

interface InternalRange extends FoldRange {
  closeTok: Tok;
}

export function buildBracketRanges(lines: readonly TokLine[], doc: DocLike, cfg: LensConfig): FoldRange[] {
  const pairs = collectPairs(lines, doc);
  const wrapped = cfg.preview.brackets && cfg.brackets.foldClosing;
  const ranges: InternalRange[] = [];

  for (const { open, close } of pairs) {
    if (open.line >= close.line) continue;
    const end = close.line - (cfg.brackets.foldClosing ? 0 : 1);
    if (end <= open.line) continue;
    ranges.push({
      start: open.line,
      end,
      startColumn: wrapped ? open.start : undefined,
      collapsedText: previewText(open, close, lines, doc, cfg, wrapped),
      kind: undefined,
      closeTok: close,
    });
  }

  if (cfg.preview.chaining && wrapped) chainRanges(ranges, doc);

  return ranges.map(({ closeTok: _closeTok, ...range }) => range);
}

function collectPairs(lines: readonly TokLine[], doc: DocLike): BracketPair[] {
  const stack: { ch: string; tok: Tok }[] = [];
  const pairs: BracketPair[] = [];

  for (const { tokens } of lines) {
    for (const tok of tokens) {
      if (!isCodeToken(tok)) continue;
      const text = tokenText(doc, tok);
      if (isTypeParamAngle(tok, text)) {
        if (text === "<") stack.push({ ch: "<", tok });
        else if (text === ">") matchClose(stack, "<", tok, pairs);
        continue;
      }
      for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        // angle brackets are only paired via exact typeparameters tokens, never as raw chars
        if (ch === "<" || ch === ">") continue;
        if (OPEN_TO_CLOSE[ch]) {
          stack.push({ ch, tok: shift(tok, i) });
        } else if (CLOSE_TO_OPEN[ch]) {
          matchClose(stack, CLOSE_TO_OPEN[ch] as string, shift(tok, i), pairs);
        }
      }
    }
  }
  return pairs;
}

function isCodeToken(tok: Tok): boolean {
  return !tok.scopes.some((s) => s.startsWith("comment") || s.startsWith("string"));
}

function isTypeParamAngle(tok: Tok, text: string): boolean {
  return (
    (text === "<" || text === ">") && tok.scopes.some((s) => s.startsWith("punctuation.definition.typeparameters"))
  );
}

function shift(tok: Tok, offset: number): Tok {
  return {
    line: tok.line,
    start: tok.start + offset,
    end: tok.start + offset + 1,
    scopes: tok.scopes,
  };
}

function matchClose(stack: { ch: string; tok: Tok }[], openCh: string, closeTok: Tok, pairs: BracketPair[]): void {
  while (stack.length > 0) {
    const top = stack.pop();
    if (top && top.ch === openCh) {
      pairs.push({ open: top.tok, close: closeTok });
      return;
    }
  }
}

function previewText(
  open: Tok,
  close: Tok,
  lines: readonly TokLine[],
  doc: DocLike,
  cfg: LensConfig,
  wrapped: boolean,
): string {
  const openText = tokenText(doc, open);
  const closeText = tokenText(doc, close);
  const fallback = cfg.preview.lineCount ? lineCountText(close.line - open.line - 1) : "…";

  let core: string;
  if (wrapped && cfg.preview.functionParams && openText === "(") {
    core = functionParamsText(tokensBetween(open, close, lines), doc);
  } else if (wrapped && cfg.preview.objectProperties && openText === "{" && isObjectLiteral(open)) {
    core = objectPreviewText(open, close, doc) ?? fallback;
  } else if (cfg.preview.lineCount) {
    core = lineCountText(close.line - open.line - 1);
  } else {
    core = "…";
  }

  return wrapped ? `${openText}${core}${closeText}` : core;
}

function tokensBetween(open: Tok, close: Tok, lines: readonly TokLine[]): Tok[] {
  const result: Tok[] = [];
  for (let line = open.line; line <= close.line && line < lines.length; line++) {
    for (const tok of lines[line]?.tokens ?? []) {
      const afterOpen = tok.line > open.line || tok.start >= open.end;
      const beforeClose = tok.line < close.line || tok.end <= close.start;
      if (afterOpen && beforeClose) result.push(tok);
    }
  }
  return result;
}

function chainRanges(ranges: InternalRange[], doc: DocLike): void {
  ranges.sort((a, b) => b.end - a.end);
  const byStartLine = new Map<number, InternalRange[]>();
  for (const r of ranges) {
    const list = byStartLine.get(r.start);
    if (list) list.push(r);
    else byStartLine.set(r.start, [r]);
  }

  for (const r of ranges) {
    const candidates = (byStartLine.get(r.closeTok.line) ?? [])
      .filter((c) => c !== r && c.startColumn !== undefined && c.startColumn >= r.closeTok.end)
      .sort((a, b) => (a.startColumn ?? 0) - (b.startColumn ?? 0));
    const chain = candidates[0];
    if (!chain) continue;
    const between = doc.lineAt(r.closeTok.line).text.substring(r.closeTok.end, chain.startColumn);
    r.end = chain.end;
    r.collapsedText = (r.collapsedText ?? "") + between + (chain.collapsedText ?? "");
  }
}
