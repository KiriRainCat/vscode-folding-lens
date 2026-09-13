import type { FoldingService } from "./service";
import type { FoldingRangeProvider, TextDocument } from "vscode";

import { EventEmitter, FoldingRange, FoldingRangeKind } from "vscode";

export class LensFoldingProvider implements FoldingRangeProvider {
  private readonly changes = new EventEmitter<void>();
  readonly onDidChangeFoldingRanges = this.changes.event;

  refresh(): void {
    this.changes.fire();
  }

  dispose(): void {
    this.changes.dispose();
  }

  constructor(private readonly service: FoldingService) {}

  async provideFoldingRanges(document: TextDocument): Promise<FoldingRange[] | undefined> {
    const ranges = await this.service.ranges(document);
    // undefined (not []) when we contribute nothing: VS Code only falls back to
    // indentation folding when no provider returns ranges — an empty array
    // would kill that fallback
    if (ranges.length === 0) return undefined;
    return ranges.map((r) => new FoldingRange(r.start, r.end, r.kind === "comment" ? FoldingRangeKind.Comment : undefined));
  }
}
