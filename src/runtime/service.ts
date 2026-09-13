import type { Tokenizer } from "./tokenizer";
import type { FoldRange, LensConfig } from "@/types";
import type { TextDocument, Uri } from "vscode";

import { buildBracketRanges } from "@/tokens/brackets";
import { buildCommentRanges } from "@/tokens/comments";

interface CacheEntry {
  version: number;
  ranges: FoldRange[];
}

export class FoldingService {
  private cache = new Map<string, CacheEntry>();

  invalidate(uri: Uri): void {
    this.cache.delete(uri.toString());
  }

  invalidateAll(): void {
    this.cache = new Map();
  }

  constructor(
    private readonly tokenizer: Tokenizer,
    private readonly readConfig: () => LensConfig,
  ) {}

  rangesSync(document: TextDocument): FoldRange[] | undefined {
    const entry = this.cache.get(document.uri.toString());
    return entry?.version === document.version ? entry.ranges : undefined;
  }

  async ranges(document: TextDocument): Promise<FoldRange[]> {
    const key = document.uri.toString();
    const hit = this.cache.get(key);
    if (hit?.version === document.version) return hit.ranges;

    const cache = this.cache;
    const version = document.version;
    const lines = await this.tokenizer.lines(document);
    if (cache !== this.cache || version !== document.version) return this.ranges(document);

    let ranges: FoldRange[] = [];
    if (lines) {
      const cfg = this.readConfig();
      ranges = [...buildBracketRanges(lines, document, cfg), ...buildCommentRanges(lines, document, cfg)];
    }

    const byStart = new Map<number, FoldRange>();
    for (const range of ranges) {
      const previous = byStart.get(range.start);
      if (!previous || range.end > previous.end || (range.end === previous.end && range.kind === "comment")) {
        byStart.set(range.start, range);
      }
    }

    ranges = [...byStart.values()].sort((a, b) => a.start - b.start);
    this.cache.set(key, { version: document.version, ranges });
    return ranges;
  }
}
