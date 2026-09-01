import { defineConfig } from "tsdown";

export default defineConfig({
  deps: {
    neverBundle: ["vscode"],
    // bundle runtime deps: the vsix then ships zero node_modules,
    // which also sidesteps vsce's npm-based dependency pruning
    alwaysBundle: ["vscode-textmate", "vscode-oniguruma"],
  },
  copy: ["node_modules/vscode-oniguruma/release/onig.wasm"],
});
