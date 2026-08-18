import type { DocLike, LensConfig, Tok, TokLine } from "@/types";

export function makeDoc(lines: string[]): DocLike {
  return {
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] ?? "" }),
  };
}

export function tok(line: number, start: number, end: number, scopes: string[]): Tok {
  return { line, start, end, scopes };
}

export function toLines(tokens: readonly Tok[], lineCount: number): TokLine[] {
  return Array.from({ length: lineCount }, (_, i) => ({
    tokens: tokens.filter((t) => t.line === i),
  }));
}

export function allOn(): LensConfig {
  return {
    brackets: { foldClosing: true },
    preview: {
      lineCount: true,
      brackets: true,
      functionParams: true,
      chaining: true,
      objectProperties: true,
    },
    tags: { foldClosing: true, keepFirstLineAttributes: true },
    comments: { foldable: true, previewMaxLength: 80 },
  };
}
