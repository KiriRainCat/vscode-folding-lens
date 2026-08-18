# Folding Lens

Better folding for VS Code: closing brackets/tags included in the fold, and readable previews on collapsed ranges.

Powered by real TextMate tokenization (no regex heuristics), so brackets inside strings and comments are never miscounted.

## Features

**Closing brackets in the fold** — folding a block includes its `}` / `]` / `)` line.

**Closing tags in the fold** — JSX / TSX / HTML / XML folds include `</div>`; the opening tag's first-line attributes (e.g. `className`, `onClick`) stay visible as real, syntax-highlighted text.

**Imports left native** — import statements are not folded by this extension; VS Code's own providers (tsserver, Pylance, …) handle them, so whole-block import folds and `editor.foldingImportsByDefault` work as usual.

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
- A second provider registration ~2s after opening a file re-asserts precedence over late-registering built-in providers, so native folding may briefly show before Folding Lens takes over.

## Development

```sh
pnpm install
pnpm check   # typecheck
pnpm build   # bundle to dist/ (onig.wasm copied via tsdown)
pnpm bundle  # package to .vsix
```

Press F5 to launch the Extension Development Host.

## Acknowledgements

Inspired by [Better Folding](https://github.com/mtbaqer/vscode-better-folding) — the idea of folding closing brackets/tags into the range and rendering custom collapsed previews comes from there. This project is an independent reimplementation, but owes its product concept to the original.

The decoration technique for custom collapsed text (hiding folded text via `display:none` and injecting previews through `::before` content) follows the approach pioneered by the original extension and [vscode-explicit-folding](https://github.com/zokugun/vscode-explicit-folding).

## License

MIT
