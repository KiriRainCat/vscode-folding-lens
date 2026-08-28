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
  // => …)` → `context`
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

// a callback argument's parameter list — only a parameter list at the top
// level of the arguments qualifies; one nested inside another argument's
// brackets (`.input(z.strictObject({ … .refine((value) => …) }))`) belongs
// to that argument, not to this call's signature
function callbackParams(code: readonly Tok[], doc: DocLike): readonly Tok[] | null {
  let depth = 0;
  let start = -1;
  for (let i = 0; i < code.length; i++) {
    const tok = code[i]!;
    if (depth === 0 && isParamsOpen(tok)) {
      start = i;
      break;
    }
    depth += bracketDelta(tokenText(doc, tok));
  }
  if (start < 0) return null;
  const out: Tok[] = [];
  let inner = 1;
  for (const tok of code.slice(start + 1)) {
    inner += bracketDelta(tokenText(doc, tok));
    if (inner <= 0) break;
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

// preview for a folded object literal: the first property, kept verbatim while
// it fits the budget — including bracket groups that close on the same line
// (`z.uuidv7()`, `async (request) =>`); a group that overflows the budget or
// is still open at end of line (a multi-line value) is cut back to the text
// before it plus a single ellipsis
export function objectPreviewText(open: Tok, close: Tok, doc: DocLike): string | undefined {
  let collected = "";
  let sawContent = false;
  let stoppedAtComma = false;
  let depth = 0;
  // collected.length where the currently open top-level group began
  let mark = 0;
  let quote: string | undefined;
  let line = open.line;
  let col = open.end;

  const atClose = () => line === close.line && col >= close.start;
  const elideOpenGroup = () => {
    const prefix = collected.slice(0, mark).trimEnd();
    collected = prefix ? `${prefix} ${ELLIPSIS}` : ELLIPSIS;
  };

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
        if (depth === 0) mark = collected.length;
        depth++;
        collected += ch;
        sawContent = true;
      } else if ((ch === "}" || ch === "]" || ch === ")") && depth > 0) {
        depth--;
        collected += ch;
        // scanning continues past an elided group so a following top-level
        // comma still yields the ", …" tail
        if (depth === 0 && collected.length > MAX_OBJECT_PREVIEW_CHARS) elideOpenGroup();
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
      } else {
        collected += ch;
        if (/\S/.test(ch)) sawContent = true;
      }
      // the per-char budget only bites at depth 0: a group's text is judged
      // as a whole when it closes
      if (depth === 0 && collected.length >= MAX_OBJECT_PREVIEW_CHARS) break outer;
      col++;
    }
    if (sawContent) break;
    line++;
    col = 0;
  }

  if (!sawContent) return undefined;
  if (depth > 0) elideOpenGroup();
  collected = collected.trimEnd();
  // an already-elided value must not gain a second ellipsis; the trailing
  // space pads the wrapped close bracket (`{ id: 123, … }`)
  if (collected.endsWith(ELLIPSIS) && !stoppedAtComma) return ` ${collected} `;
  return ` ${collected}${stoppedAtComma ? " " : ""}${ELLIPSIS} `;
}
