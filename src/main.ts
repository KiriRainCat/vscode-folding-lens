import { type ExtensionContext, commands, extensions, languages, window, workspace } from "vscode";

import { getConfig } from "./config";
import { GrammarRegistry } from "./runtime/grammar";
import { LensFoldingProvider } from "./runtime/provider";
import { Renderer } from "./runtime/renderer";
import { FoldingService } from "./runtime/service";
import { FoldState } from "./runtime/state";
import { Tokenizer } from "./runtime/tokenizer";

export function activate(context: ExtensionContext): void {
  const grammars = new GrammarRegistry();
  const tokenizer = new Tokenizer(grammars);
  const service = new FoldingService(tokenizer, getConfig);
  const foldState = new FoldState();
  const renderer = new Renderer(service, foldState);

  // '*' selectors score lower than exact language matches, so built-in providers
  // would always win. Registering per-language, immediately and once more after
  // a short delay to re-assert precedence over late-registering providers,
  // makes this provider take over; duplicate ranges merge away.
  const registered = new Set<string>();
  const registerForLanguages = () => {
    for (const { document } of window.visibleTextEditors) {
      const { languageId } = document;
      if (registered.has(languageId)) continue;
      registered.add(languageId);
      context.subscriptions.push(
        languages.registerFoldingRangeProvider({ language: languageId }, new LensFoldingProvider(service)),
      );
      renderer.schedule();
      setTimeout(() => {
        context.subscriptions.push(
          languages.registerFoldingRangeProvider({ language: languageId }, new LensFoldingProvider(service)),
        );
        renderer.schedule();
      }, 2000);
    }
  };

  const reload = () => {
    tokenizer.evictAll();
    service.invalidateAll();
    renderer.schedule();
  };

  context.subscriptions.push(
    renderer,
    commands.registerCommand("foldingLens.reload", reload),
    extensions.onDidChange(() => {
      grammars.refresh();
      reload();
    }),
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
