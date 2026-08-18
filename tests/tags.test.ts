import { expect, test } from "vitest";

import { buildTagRanges } from "@/tokens/tags";

import { allOn, makeDoc, tok, toLines } from "./utils";

const BEGIN = ["meta.tag", "punctuation.definition.tag.begin"];
const NAME = ["meta.tag", "entity.name.tag"];
const END = ["meta.tag", "punctuation.definition.tag.end"];

test("single-line opening tag keeps attributes as real text", () => {
  const src = ['<div id="x">', "  hello", "</div>"];
  const tokens = [
    tok(0, 0, 1, BEGIN),
    tok(0, 1, 4, NAME),
    tok(0, 5, 11, ["meta.tag", "meta.attribute"]),
    tok(0, 11, 12, END),
    tok(1, 2, 7, ["meta.jsx.children"]),
    tok(2, 0, 2, BEGIN),
    tok(2, 2, 5, NAME),
    tok(2, 5, 6, END),
  ];
  const ranges = buildTagRanges(toLines(tokens, 3), makeDoc(src), allOn());

  expect(ranges[0]).toEqual({
    start: 0,
    end: 2,
    startColumn: 12,
    collapsedText: " ⋯ 1 line ⋯ </div>",
    kind: undefined,
  });
});

test("multi-line opening tag hides later attributes", () => {
  const src = ["<div", '  id="x">', "  text", "</div>"];
  const tokens = [
    tok(0, 0, 1, BEGIN),
    tok(0, 1, 4, NAME),
    tok(1, 8, 9, END),
    tok(2, 2, 6, ["meta.jsx.children"]),
    tok(3, 0, 2, BEGIN),
    tok(3, 2, 5, NAME),
    tok(3, 5, 6, END),
  ];
  const ranges = buildTagRanges(toLines(tokens, 4), makeDoc(src), allOn());

  expect(ranges[0]).toEqual({
    start: 0,
    end: 3,
    startColumn: 4,
    collapsedText: "…> ⋯ 2 lines ⋯ </div>",
    kind: undefined,
  });
});

test("nested same-name tags pair correctly", () => {
  const src = ["<div>", "  <div>", "    deep", "  </div>", "</div>"];
  const tokens = [
    tok(0, 0, 1, BEGIN),
    tok(0, 1, 4, NAME),
    tok(0, 4, 5, END),
    tok(1, 2, 3, BEGIN),
    tok(1, 3, 6, NAME),
    tok(1, 6, 7, END),
    tok(2, 4, 8, ["meta.jsx.children"]),
    tok(3, 2, 4, BEGIN),
    tok(3, 4, 7, NAME),
    tok(3, 7, 8, END),
    tok(4, 0, 2, BEGIN),
    tok(4, 2, 5, NAME),
    tok(4, 5, 6, END),
  ];
  const ranges = buildTagRanges(toLines(tokens, 5), makeDoc(src), allOn());

  expect(ranges.length).toBe(2);
  expect(ranges.map((r) => [r.start, r.end]).sort()).toEqual([
    [0, 4],
    [1, 3],
  ]);
});

test("self-closing tags are skipped", () => {
  const src = ["<div>", "  <br />", "  text", "</div>"];
  const tokens = [
    tok(0, 0, 1, BEGIN),
    tok(0, 1, 4, NAME),
    tok(0, 4, 5, END),
    tok(1, 2, 3, BEGIN),
    tok(1, 3, 5, NAME),
    tok(1, 7, 9, END),
    tok(2, 2, 6, ["meta.jsx.children"]),
    tok(3, 0, 2, BEGIN),
    tok(3, 2, 5, NAME),
    tok(3, 5, 6, END),
  ];
  const ranges = buildTagRanges(toLines(tokens, 4), makeDoc(src), allOn());

  expect(ranges.length).toBe(1);
  expect([ranges[0]?.start, ranges[0]?.end]).toEqual([0, 3]);
});

test("keepFirstLineAttributes=false hides attributes behind preview", () => {
  const src = ['<div id="x">', "  hello", "</div>"];
  const tokens = [
    tok(0, 0, 1, BEGIN),
    tok(0, 1, 4, NAME),
    tok(0, 5, 11, ["meta.tag", "meta.attribute"]),
    tok(0, 11, 12, END),
    tok(1, 2, 7, ["meta.jsx.children"]),
    tok(2, 0, 2, BEGIN),
    tok(2, 2, 5, NAME),
    tok(2, 5, 6, END),
  ];
  const cfg = { ...allOn(), tags: { foldClosing: true, keepFirstLineAttributes: false } };
  const ranges = buildTagRanges(toLines(tokens, 3), makeDoc(src), cfg);

  expect(ranges[0]).toEqual({
    start: 0,
    end: 2,
    startColumn: 4,
    collapsedText: "…> ⋯ 1 line ⋯ </div>",
    kind: undefined,
  });
});
