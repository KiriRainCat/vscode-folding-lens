export interface Tok {
  line: number;
  start: number;
  end: number;
  scopes: readonly string[];
}

export interface TokLine {
  tokens: readonly Tok[];
}

export interface DocLike {
  lineAt(line: number): { readonly text: string };
}

export interface FoldRange {
  start: number;
  end: number;
  startColumn?: number;
  collapsedText: string;
  kind?: "comment";
}

export type LensConfig = ReturnType<typeof import("./config").getConfig>;
