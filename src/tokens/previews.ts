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
  // the bracket's own kind is decided by the nearest meta scope in its stack;
  // outer containers (an object literal wrapping an arrow-function body)
  // also appear there and must not claim the inner `{`
  const nearestMeta = open.scopes.findLast((s) => s.startsWith("meta."));
  if (nearestMeta !== undefined) {
    return (
      nearestMeta.startsWith("meta.object.literal") ||
      nearestMeta.startsWith("meta.object-literal") ||
      nearestMeta.startsWith("meta.objectliteral") ||
      nearestMeta.startsWith("meta.structure.literal.dict")
    );
  }
  return open.scopes.some((s) => s.startsWith("punctuation.definition.dict.begin"));
}

function isCodeToken(tok: Tok): boolean {
  return !tok.scopes.some((s) => s.startsWith("comment") || s.startsWith("string"));
}

export function functionParamsText(open: Tok, inner: readonly Tok[], doc: DocLike): string {
  const code = inner.filter(isCodeToken);
  // a folded parameter list shows its own top-level names; a folded *call*
  // (whose parens are `meta.brace.round`, not a parameter list) shows the
  // first function argument's parameter names — `.handler(async ({ context })
  // => …)` → `context`. Either way names inside nested parameter lists
  // (inline-arrow defaults, function-type annotations) never leak in.
  const scope = isParamsOpen(open) ? code : (callbackParams(code, doc) ?? []);
  const names = collectParams(scope, doc);
  return names.length > 0 ? names.join(", ") : ELLIPSIS;
}

function collectParams(code: readonly Tok[], doc: DocLike): string[] {
  const names: string[] = [];
  // >0 while skipping a nested parameter list, so its names cannot leak in
  let nested = 0;
  for (const tok of code) {
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
  return names;
}

// tokens inside the first parameter list among the arguments (the callback's)
function callbackParams(code: readonly Tok[], doc: DocLike): readonly Tok[] | null {
  const start = code.findIndex(isParamsOpen);
  if (start < 0) return null;
  const out: Tok[] = [];
  let depth = 1;
  for (const tok of code.slice(start + 1)) {
    depth += bracketDelta(tokenText(doc, tok));
    if (depth <= 0) break;
    out.push(tok);
  }
  return out;
}

function isParamsOpen(tok: Tok): boolean {
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
