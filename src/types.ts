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
  readonly lineCount: number;
  lineAt(line: number): { readonly text: string };
}

export interface FoldRange {
  start: number;
  end: number;
  // required-but-nullable instead of optional, to coexist with exactOptionalPropertyTypes
  startColumn: number | undefined;
  collapsedText: string | undefined;
  kind: "comment" | undefined;
}

export interface LensConfig {
  brackets: {
    foldClosing: boolean;
  };
  preview: {
    lineCount: boolean;
    brackets: boolean;
    functionParams: boolean;
    chaining: boolean;
    objectProperties: boolean;
    commentMaxLength: number;
  };
  tags: {
    foldClosing: boolean;
    keepFirstLineAttributes: boolean;
  };
  comments: {
    foldable: boolean;
  };
}
