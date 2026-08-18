import { expect, test } from "vitest";

import { buildBracketRanges } from "@/tokens/brackets";

import { allOn, makeDoc, tok, toLines } from "./utils";

test("params preview with chaining across closing line", () => {
  const src = ["function foo(", "  a,", "  b", ") {", "  return a + b;", "}"];
  const tokens = [
    tok(0, 12, 13, ["meta.function.parameters", "punctuation.definition.parameters.begin"]),
    tok(1, 2, 3, ["variable.parameter.function"]),
    tok(2, 2, 3, ["variable.parameter.function"]),
    tok(3, 0, 1, ["meta.function.parameters", "punctuation.definition.parameters.end"]),
    tok(3, 2, 3, ["meta.block", "punctuation.definition.block.begin"]),
    tok(5, 0, 1, ["meta.block", "punctuation.definition.block.end"]),
  ];
  const ranges = buildBracketRanges(toLines(tokens, 6), makeDoc(src), allOn());

  expect(ranges.find((r) => r.start === 0)).toEqual({
    start: 0,
    end: 5,
    startColumn: 12,
    collapsedText: "(a, b) { ⋯ 1 line ⋯ }",
    kind: undefined,
  });
  expect(ranges.find((r) => r.start === 3)).toEqual({
    start: 3,
    end: 5,
    startColumn: 2,
    collapsedText: "{ ⋯ 1 line ⋯ }",
    kind: undefined,
  });
});

test("brackets inside comments and strings are ignored", () => {
  const src = ['const a = "{ no fold";', "/* {", "   } */", "const b = {", "  x: 1,", "};"];
  const tokens = [
    tok(0, 12, 21, ["string.quoted.double"]),
    tok(1, 0, 2, ["comment.block"]),
    tok(2, 3, 5, ["comment.block"]),
    tok(3, 10, 11, ["meta.object.literal", "punctuation.definition.block"]),
    tok(5, 0, 1, ["meta.object.literal", "punctuation.definition.block"]),
  ];
  const ranges = buildBracketRanges(toLines(tokens, 6), makeDoc(src), allOn());

  expect(ranges.length).toBe(1);
  expect(ranges[0]?.start).toBe(3);
});

test("object literal preview shows first property", () => {
  const src = ["const x = {", "  id: 123,", "  other: 1,", "};"];
  const tokens = [
    tok(0, 10, 11, ["meta.object.literal", "punctuation.definition.block.begin"]),
    tok(3, 0, 1, ["meta.object.literal", "punctuation.definition.block.end"]),
  ];
  const ranges = buildBracketRanges(toLines(tokens, 4), makeDoc(src), allOn());

  expect(ranges[0]).toEqual({
    start: 0,
    end: 3,
    startColumn: 10,
    collapsedText: "{ id: 123, …}",
    kind: undefined,
  });
});

test("generics fold, comparison operators do not", () => {
  const src = ["const x: Foo<", "  Bar,", ">= 1;", "function f<A,", "  B>(a: A) {}"];
  const tokens = [
    tok(0, 12, 13, ["punctuation.definition.typeparameters.begin"]),
    tok(2, 0, 1, ["keyword.operator.comparison"]),
    tok(2, 1, 2, ["keyword.operator.comparison"]),
    tok(3, 10, 11, ["punctuation.definition.typeparameters.begin"]),
    tok(4, 3, 4, ["punctuation.definition.typeparameters.end"]),
    tok(4, 11, 12, ["meta.block"]),
    tok(4, 12, 13, ["meta.block"]),
  ];
  const ranges = buildBracketRanges(toLines(tokens, 5), makeDoc(src), allOn());

  expect(ranges.length).toBe(1);
  expect(ranges[0]?.start).toBe(3);
});

test("foldClosing=false excludes closing line and disables bracket preview wrap", () => {
  const src = ["function f() {", "  body;", "}"];
  const tokens = [
    tok(0, 13, 14, ["punctuation.definition.block.begin"]),
    tok(2, 0, 1, ["punctuation.definition.block.end"]),
  ];
  const cfg = { ...allOn(), brackets: { foldClosing: false } };
  const ranges = buildBracketRanges(toLines(tokens, 3), makeDoc(src), cfg);

  expect(ranges[0]).toEqual({
    start: 0,
    end: 1,
    startColumn: undefined,
    collapsedText: " ⋯ 1 line ⋯ ",
    kind: undefined,
  });
});
