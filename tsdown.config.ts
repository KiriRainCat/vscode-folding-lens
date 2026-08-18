import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts"],
  deps: {
    neverBundle: ["vscode"],
    // bundle runtime deps: the vsix then ships zero node_modules,
    // which also sidesteps vsce's npm-based dependency pruning on pnpm layouts
    alwaysBundle: ["vscode-textmate", "vscode-oniguruma"],
  },
  copy: ["node_modules/vscode-oniguruma/release/onig.wasm"],
});
