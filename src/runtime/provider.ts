import { FoldingRange, FoldingRangeKind } from "vscode";
import type { FoldingRangeProvider, TextDocument } from "vscode";

import type { FoldingService } from "./service";

export class LensFoldingProvider implements FoldingRangeProvider {
  constructor(private readonly service: FoldingService) {}

  async provideFoldingRanges(document: TextDocument): Promise<FoldingRange[]> {
    const ranges = await this.service.ranges(document);
    return ranges.map(
      (r) => new FoldingRange(r.start, r.end, r.kind === "comment" ? FoldingRangeKind.Comment : undefined),
    );
  }
}
