import { type ExtensionContext, languages, window, workspace } from "vscode";

import { getConfig } from "./config";
import { GrammarRegistry } from "./runtime/grammar";
import { LensFoldingProvider } from "./runtime/provider";
import { Renderer } from "./runtime/renderer";
import { FoldingService } from "./runtime/service";
import { FoldState } from "./runtime/state";
import { Tokenizer } from "./runtime/tokenizer";

export function activate(context: ExtensionContext): void {
  const tokenizer = new Tokenizer(new GrammarRegistry());
  const service = new FoldingService(tokenizer, getConfig);
  const foldState = new FoldState();
  const renderer = new Renderer(service, foldState);

  // '*' selectors score lower than exact language matches, so built-in providers
  // would always win. Registering per-language, slightly delayed, makes this
  // provider take precedence over the default language folding providers.
  const registered = new Set<string>();
  const registerForLanguages = () => {
    for (const { document } of window.visibleTextEditors) {
      if (registered.has(document.languageId)) continue;
      registered.add(document.languageId);
      setTimeout(() => {
        context.subscriptions.push(
          languages.registerFoldingRangeProvider({ language: document.languageId }, new LensFoldingProvider(service)),
        );
        renderer.schedule();
      }, 2000);
    }
  };

  context.subscriptions.push(
    renderer,
    workspace.onDidChangeTextDocument((e) => {
      let minLine = Number.MAX_SAFE_INTEGER;
      for (const change of e.contentChanges) minLine = Math.min(minLine, change.range.start.line);
      tokenizer.invalidate(e.document, minLine);
      service.invalidate(e.document.uri);
      renderer.schedule();
    }),
    workspace.onDidCloseTextDocument((doc) => {
      tokenizer.evict(doc.uri);
      service.evict(doc.uri);
    }),
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("foldingLens")) {
        service.invalidateAll();
        renderer.schedule();
      }
    }),
    window.onDidChangeTextEditorVisibleRanges((e) => {
      foldState.update(e.textEditor);
      void renderer.updateNow(e.textEditor);
    }),
    window.onDidChangeVisibleTextEditors(() => {
      registerForLanguages();
      renderer.schedule();
    }),
  );

  registerForLanguages();
  renderer.schedule();
}

export function deactivate(): void {}
