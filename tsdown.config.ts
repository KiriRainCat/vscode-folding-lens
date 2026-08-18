import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts"],
  deps: { neverBundle: ["vscode"] },
  copy: ["node_modules/vscode-oniguruma/release/onig.wasm"],
});
