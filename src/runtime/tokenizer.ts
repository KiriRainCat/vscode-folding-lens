import type { TextDocument, Uri } from "vscode";
import vsctm from "vscode-textmate";

import type { Tok, TokLine } from "../types";
import type { GrammarRegistry } from "./grammar";

interface LineState {
  ruleStack: vsctm.StateStack;
  tokens: Tok[];
}

/**
 * Per-document line cache with incremental tokenization:
 * lines before `fromLine` survive edits, everything after is re-tokenized
 * using the previous line's rule stack.
 */
export class Tokenizer {
  private readonly docs = new Map<string, LineState[]>();

  constructor(private readonly grammars: GrammarRegistry) {}

  invalidate(document: TextDocument, fromLine: number): void {
    const state = this.docs.get(document.uri.toString());
    if (state) state.length = Math.min(state.length, fromLine);
  }

  evict(uri: Uri): void {
    this.docs.delete(uri.toString());
  }

  async lines(document: TextDocument): Promise<TokLine[] | null> {
    const grammar = await this.grammars.grammar(document.languageId);
    if (!grammar) return null;

    const key = document.uri.toString();
    let state = this.docs.get(key);
    if (!state) {
      state = [];
      this.docs.set(key, state);
    }

    for (let i = state.length; i < document.lineCount; i++) {
      const text = document.lineAt(i).text;
      const prevStack = i > 0 ? state[i - 1]?.ruleStack : undefined;
      const result = grammar.tokenizeLine(text, prevStack ?? vsctm.INITIAL);
      state[i] = {
        ruleStack: result.ruleStack,
        tokens: result.tokens.map((t) => ({
          line: i,
          start: t.startIndex,
          end: t.endIndex,
          scopes: t.scopes,
        })),
      };
    }
    state.length = document.lineCount;
    return state;
  }
}
