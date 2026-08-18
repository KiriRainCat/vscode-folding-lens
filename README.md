# Folding Lens

Better folding for VS Code: closing brackets/tags included in the fold, and readable previews on collapsed ranges.

Powered by real TextMate tokenization (no regex heuristics), so brackets inside strings and comments are never miscounted.

## Features

**Closing brackets in the fold** — folding a block includes its `}` / `]` / `)` line.

**Closing tags in the fold** — JSX / TSX / HTML / XML folds include `</div>`; the opening tag's first-line attributes (e.g. `className`, `onClick`) stay visible as real, syntax-highlighted text.

**Readable folded previews**

| Collapsed range    | Preview                                           |
| ------------------ | ------------------------------------------------- |
| Function           | `function example(first, second) { ⋯ 3 lines ⋯ }` |
| Object literal     | `{ id: 123, … }`                                  |
| Generics           | `Foo<Bar, ⋯ 2 lines ⋯ >`                          |
| JSX element        | `<div id="x" ⋯ 3 lines ⋯ </div>`                  |
| Block comment      | `/** Calculates the total price ⋯ */`             |
| Line-comment group | `// TODO: refactor this`                          |

Comment ranges are registered as `FoldingRangeKind.Comment`, so the built-in "Fold All Comments" command works with them.

## Settings

| Setting                                    | Default | Description                                                |
| ------------------------------------------ | ------- | ---------------------------------------------------------- |
| `foldingLens.brackets.foldClosing`         | `true`  | Include closing brackets in the folding range              |
| `foldingLens.preview.lineCount`            | `true`  | Show folded line count in the preview                      |
| `foldingLens.preview.brackets`             | `true`  | Wrap preview with brackets (`{…}`)                         |
| `foldingLens.preview.functionParams`       | `true`  | Show parameter names for folded multi-line parameter lists |
| `foldingLens.preview.chaining`             | `true`  | Chain ranges that start where another ends (`f(…) {…}`)    |
| `foldingLens.preview.objectProperties`     | `true`  | Show first property of folded object literals              |
| `foldingLens.tags.foldClosing`             | `true`  | Include closing tags in the folding range                  |
| `foldingLens.tags.keepFirstLineAttributes` | `true`  | Keep the opening tag's first-line attributes as real text  |
| `foldingLens.comments.foldable`            | `true`  | Make comments foldable with readable previews              |
| `foldingLens.comments.preview.maxLength`   | `80`    | Max comment preview length                                 |

## Known limitations

- The cursor can occasionally hide behind injected preview text — inherent to the decoration-based approach.
- Folding providers are registered per-language with a short delay on first open, so the first ~2s after opening a file may show native folding before Folding Lens takes over.

## Development

```sh
pnpm install
pnpm check   # typecheck
pnpm test    # unit tests (builders)
pnpm build   # bundle to dist/ (onig.wasm copied via tsdown)
```

Press F5 to launch the Extension Development Host.

## License

MIT
