import type { DocLike, Tok } from "@/types";

const ELLIPSIS = "…";
const MAX_OBJECT_PREVIEW_CHARS = 40;

export function lineCountText(innerLines: number): string {
  const n = Math.max(innerLines, 0);
  return ` ⋯ ${n} ${n === 1 ? "line" : "lines"} ⋯ `;
}

export function tokenText(doc: DocLike, tok: Tok): string {
  return doc.lineAt(tok.line).text.substring(tok.start, tok.end);
}

export function isObjectLiteral(open: Tok): boolean {
  return open.scopes.some(
    (s) =>
      s.startsWith("meta.object.literal") ||
      s.startsWith("meta.object-literal") ||
      s.startsWith("meta.objectliteral") ||
      s.startsWith("punctuation.definition.dict.begin"),
  );
}

export function functionParamsText(params: readonly Tok[], doc: DocLike): string {
  const names = params
    .filter((t) => t.scopes.some((s) => s.startsWith("variable.parameter")))
    .map((t) => tokenText(doc, t))
    .filter((n) => n.length > 0);
  return names.length > 0 ? names.join(", ") : ELLIPSIS;
}

export function objectPreviewText(open: Tok, close: Tok, doc: DocLike): string | undefined {
  let collected = "";
  let sawContent = false;
  let stoppedAtComma = false;
  let depth = 0;
  let quote: string | undefined;
  let line = open.line;
  let col = open.end;

  const atClose = () => line === close.line && col >= close.start;

  outer: while (line <= close.line && !atClose()) {
    const text = doc.lineAt(line).text;
    while (col < text.length) {
      if (atClose()) break outer;
      const ch = text[col] as string;
      if (quote) {
        collected += ch;
        if (ch === quote) quote = undefined;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        collected += ch;
        sawContent = true;
      } else if (ch === "{" || ch === "[" || ch === "(") {
        depth++;
        if (depth === 1) collected += ELLIPSIS;
      } else if (ch === "}" || ch === "]" || ch === ")") {
        depth--;
      } else if (depth === 0 && ch === ",") {
        if (sawContent) {
          collected += ",";
          stoppedAtComma = true;
        }
        break outer;
      } else if (depth === 0) {
        if (/\S/.test(ch)) {
          collected += ch;
          sawContent = true;
        } else if (sawContent) {
          collected += ch;
        }
      }
      if (collected.length >= MAX_OBJECT_PREVIEW_CHARS) break outer;
      col++;
    }
    if (sawContent) break;
    line++;
    col = 0;
  }

  if (!sawContent) return undefined;
  collected = collected.trimEnd();
  return ` ${collected}${stoppedAtComma ? " " : ""}${ELLIPSIS}`;
}
