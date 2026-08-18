import type { TextDocument, Uri } from "vscode";

import { buildBracketRanges } from "../tokens/brackets";
import { buildCommentRanges } from "../tokens/comments";
import { buildTagRanges } from "../tokens/tags";
import type { FoldRange, LensConfig } from "../types";
import type { Tokenizer } from "./tokenizer";

interface CacheEntry {
  version: number;
  ranges: FoldRange[];
}

export class FoldingService {
  private readonly cache = new Map<string, CacheEntry>();

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

    const lines = await this.tokenizer.lines(document);
    let ranges: FoldRange[] = [];
    if (lines) {
      const cfg = this.readConfig();
      ranges = [
        ...buildBracketRanges(lines, document, cfg),
        ...buildTagRanges(lines, document, cfg),
        ...buildCommentRanges(lines, document, cfg),
      ];
    }
    this.cache.set(key, { version: document.version, ranges });
    return ranges;
  }

  invalidate(uri: Uri): void {
    this.cache.delete(uri.toString());
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  evict(uri: Uri): void {
    this.cache.delete(uri.toString());
  }
}
