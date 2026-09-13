import type { DocLike, FoldRange, LensConfig, Tok, TokLine } from "@/types";

import { functionParamsText, isCodeToken, isParamsOpen, lineCountText, tokenText } from "./previews";

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
  const byStart = new Map<number, InternalRange>();

  for (const { open, close } of pairs) {
    if (open.line >= close.line) continue;

    const end = close.line - (cfg.brackets.foldClosing ? 0 : 1);
    if (end <= open.line) continue;

    const range: InternalRange = {
      start: open.line,
      end,
      ...(wrapped ? { startColumn: open.start } : {}),
      collapsedText: previewText(open, close, lines, doc, cfg, wrapped),
      closeTok: close,
    };

    // Pairs arrive inside-out. Keep the inner anchor while extending to the outer close.
    const inner = byStart.get(open.line);
    if (wrapped && inner?.startColumn !== undefined) {
      range.startColumn = inner.startColumn;
      range.collapsedText = inner.collapsedText + tokenText(doc, close);
    }

    byStart.set(open.line, range);
  }

  const ranges = [...byStart.values()];
  if (cfg.preview.chaining && wrapped) {
    // Later starts must be chained before their predecessors consume their previews.
    ranges.sort((a, b) => b.start - a.start);

    for (const range of ranges) {
      const next = byStart.get(range.closeTok.line);
      if (!next || next.startColumn === undefined || next.startColumn < range.closeTok.end) continue;
      const between = doc.lineAt(range.closeTok.line).text.substring(range.closeTok.end, next.startColumn);
      range.end = next.end;
      range.collapsedText += between + next.collapsedText;
    }
  }

  return ranges.map(({ closeTok: _closeTok, ...range }) => range);
}

function collectPairs(lines: readonly TokLine[], doc: DocLike): BracketPair[] {
  const stack: { ch: string; tok: Tok }[] = [];
  const pairs: BracketPair[] = [];

  for (const { tokens } of lines) {
    for (const tok of tokens) {
      if (!isCodeToken(tok)) continue;
      // import statements are left to VS Code's own folding providers: pairing
      // them here would displace the native whole-block import fold, which also
      // powers `editor.foldingImportsByDefault`
      if (isImportToken(tok)) continue;

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

function isImportToken(tok: Tok): boolean {
  return tok.scopes.some((s) => s.startsWith("meta.import"));
}

function isTypeParamAngle(tok: Tok, text: string): boolean {
  return (text === "<" || text === ">") && tok.scopes.some((s) => s.startsWith("punctuation.definition.typeparameters"));
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

function previewText(open: Tok, close: Tok, lines: readonly TokLine[], doc: DocLike, cfg: LensConfig, wrapped: boolean): string {
  const openText = tokenText(doc, open);
  const closeText = tokenText(doc, close);
  const fallback = cfg.preview.lineCount ? lineCountText(close.line - open.line - 1) : "…";

  const core =
    wrapped && cfg.preview.functionParams && isParamsOpen(open)
      ? (functionParamsText(tokensBetween(open, close, lines), doc) ?? fallback)
      : fallback;

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
