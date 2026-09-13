import type { DocLike, Tok } from "@/types";

export function lineCountText(innerLines: number): string {
  const n = Math.max(innerLines, 0);
  return ` ⋯ ${n} ${n === 1 ? "line" : "lines"} ⋯ `;
}

export function tokenText(doc: DocLike, tok: Tok): string {
  return doc.lineAt(tok.line).text.substring(tok.start, tok.end);
}

export function isCodeToken(tok: Tok): boolean {
  return !tok.scopes.some((s) => s.startsWith("comment") || s.startsWith("string"));
}

export function functionParamsText(code: readonly Tok[], doc: DocLike): string | undefined {
  const names: string[] = [];

  // >0 while skipping a nested parameter list, so its names cannot leak in
  let nested = 0;

  for (const tok of code) {
    if (!isCodeToken(tok)) continue;

    if (nested > 0) {
      nested += bracketDelta(tokenText(doc, tok));
      continue;
    }

    if (isParamsOpen(tok)) {
      nested = 1;
      continue;
    }

    const text = tokenText(doc, tok);
    if (text.length > 0 && tok.scopes.some((s) => s.startsWith("variable.parameter"))) names.push(text);
  }

  return names.length ? names.join(", ") : undefined;
}

export function isParamsOpen(tok: Tok): boolean {
  return tok.scopes.some((s) => s.startsWith("punctuation.definition.parameters.begin"));
}

function bracketDelta(text: string): number {
  let delta = 0;

  for (const ch of text) {
    if (ch === "(" || ch === "{" || ch === "[") delta++;
    else if (ch === ")" || ch === "}" || ch === "]") delta--;
  }

  return delta;
}
