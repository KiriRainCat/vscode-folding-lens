import * as fs from "node:fs";
import * as path from "node:path";

import { extensions } from "vscode";
import onig from "vscode-oniguruma";
import vsctm from "vscode-textmate";

/**
 * Grammar discovery (from installed extensions' contributions) and loading.
 * All VSCode / fs / wasm interop lives here, so the Tokenizer itself stays
 * free of environment concerns.
 */
export class GrammarRegistry {
  private readonly scopeToPath = new Map<string, string>();
  private readonly languageToScope = new Map<string, string>();
  private registry: vsctm.Registry | undefined;

  constructor() {
    for (const ext of extensions.all) {
      const grammars = ext.packageJSON?.contributes?.grammars;
      if (!Array.isArray(grammars)) continue;
      for (const g of grammars) {
        if (typeof g?.scopeName !== "string" || typeof g?.path !== "string") continue;
        if (!this.scopeToPath.has(g.scopeName)) {
          this.scopeToPath.set(g.scopeName, path.join(ext.extensionPath, g.path));
        }
        if (typeof g.language === "string" && !this.languageToScope.has(g.language)) {
          this.languageToScope.set(g.language, g.scopeName);
        }
      }
    }
  }

  async grammar(languageId: string): Promise<vsctm.IGrammar | null> {
    const scope = this.languageToScope.get(languageId);
    if (!scope) return null;

    this.registry ??= new vsctm.Registry({
      onigLib: loadOnigLib(),
      loadGrammar: async (scopeName) => {
        const grammarPath = this.scopeToPath.get(scopeName);
        if (!grammarPath) return null;
        try {
          const content = await fs.promises.readFile(grammarPath, "utf8");
          return vsctm.parseRawGrammar(content, grammarPath);
        } catch {
          return null;
        }
      },
    });

    return (await this.registry.loadGrammar(scope)) ?? null;
  }
}

let onigLib:
  | Promise<{
      createOnigScanner: (sources: string[]) => onig.OnigScanner;
      createOnigString: (str: string) => onig.OnigString;
    }>
  | undefined;

function loadOnigLib() {
  onigLib ??= (async () => {
    // onig.wasm is shipped next to the bundled entry; fs accepts a URL directly
    const wasmUrl = new URL("onig.wasm", import.meta.url);
    const buffer = await fs.promises.readFile(wasmUrl);
    const bytes = new Uint8Array(buffer);
    await onig.loadWASM(bytes.buffer);
    return {
      createOnigScanner: (sources: string[]) => new onig.OnigScanner(sources),
      createOnigString: (str: string) => new onig.OnigString(str),
    };
  })();
  return onigLib;
}
