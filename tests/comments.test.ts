import { expect, test } from "vitest";

import { buildCommentRanges } from "@/tokens/comments";

import { allOn, makeDoc, toLines, tok } from "./utils";

const BLOCK = ["comment.block.documentation"];

test("block comment folds with readable preview from first content line", () => {
  const src = ["/**", " * Calculates the total price", " * including tax.", " */"];
  const tokens = [tok(0, 0, 3, BLOCK), tok(1, 1, 30, BLOCK), tok(2, 1, 16, BLOCK), tok(3, 1, 3, BLOCK)];
  const ranges = buildCommentRanges(toLines(tokens, 4), makeDoc(src), allOn());

  expect(ranges[0]).toEqual({
    start: 0,
    end: 3,
    kind: "comment",
    startColumn: 3,
    collapsedText: " Calculates the total price ⋯ */",
  });
});

test("tag-only doc comment previews the first tag", () => {
  const src = ["/**", " * @param price the base price", " * @returns total", " */"];
  const tokens = [tok(0, 0, 3, BLOCK), tok(1, 1, 30, BLOCK), tok(2, 1, 17, BLOCK), tok(3, 1, 3, BLOCK)];
  const ranges = buildCommentRanges(toLines(tokens, 4), makeDoc(src), allOn());

  expect(ranges[0]?.collapsedText).toBe(" @param price the base price ⋯ */");
});

test("consecutive line comments group into one fold", () => {
  const src = ["// TODO: fix this", "// and add tests", "const x = 1;"];
  const tokens = [
    tok(0, 0, 17, ["comment.line.double-slash"]),
    tok(1, 0, 15, ["comment.line.double-slash"]),
    tok(2, 0, 11, ["source"]),
  ];
  const ranges = buildCommentRanges(toLines(tokens, 3), makeDoc(src), allOn());

  expect(ranges[0]).toEqual({
    start: 0,
    end: 1,
    kind: "comment",
    startColumn: 2,
    collapsedText: " TODO: fix this",
  });
});

test("blank line breaks a line-comment group", () => {
  const src = ["// first", "", "// second"];
  const tokens = [tok(0, 0, 8, ["comment.line.double-slash"]), tok(2, 0, 9, ["comment.line.double-slash"])];
  const ranges = buildCommentRanges(toLines(tokens, 3), makeDoc(src), allOn());

  expect(ranges.length).toBe(0);
});

test("single line comments and code lines do not fold", () => {
  const src = ["// alone", "const x = 1; // trailing"];
  const tokens = [
    tok(0, 0, 8, ["comment.line.double-slash"]),
    tok(1, 0, 12, ["source"]),
    tok(1, 13, 24, ["comment.line.double-slash"]),
  ];
  const ranges = buildCommentRanges(toLines(tokens, 2), makeDoc(src), allOn());

  expect(ranges.length).toBe(0);
});

test("whole-line comment tokens including leading whitespace are recognized", () => {
  const src = ["/**", " * Calculates the total price", " */"];
  const tokens = [tok(0, 0, 3, BLOCK), tok(1, 0, 30, BLOCK), tok(2, 1, 3, BLOCK)];
  const ranges = buildCommentRanges(toLines(tokens, 3), makeDoc(src), allOn());

  expect(ranges[0]).toEqual({
    start: 0,
    end: 2,
    kind: "comment",
    startColumn: 3,
    collapsedText: " Calculates the total price ⋯ */",
  });
});

test("preview truncates to maxLength", () => {
  const long = "x".repeat(100);
  const src = ["/**", ` * ${long}`, " */"];
  const tokens = [tok(0, 0, 3, BLOCK), tok(1, 1, 3 + long.length, BLOCK), tok(2, 1, 3, BLOCK)];
  const cfg = { ...allOn(), comments: { foldable: true, previewMaxLength: 40 } };
  const ranges = buildCommentRanges(toLines(tokens, 3), makeDoc(src), cfg);

  const preview = ranges[0]?.collapsedText ?? "";
  expect(preview.includes("…")).toBe(true);
  expect(preview.length).toBeLessThanOrEqual(40);
});
