import type { Disposable, ExtensionContext } from "vscode";

import { commands, extensions, languages, window, workspace } from "vscode";

import { getConfig } from "./config";
import { GrammarRegistry } from "./runtime/grammar";
import { LensFoldingProvider } from "./runtime/provider";
import { Renderer } from "./runtime/renderer";
import { FoldingService } from "./runtime/service";
import { Tokenizer } from "./runtime/tokenizer";
import { registerExplorerRecursiveCommands } from "./toolkit/recursive";

export function activate(context: ExtensionContext): void {
  const grammars = new GrammarRegistry();
  const tokenizer = new Tokenizer(grammars);
  const service = new FoldingService(tokenizer, getConfig);
  const provider = new LensFoldingProvider(service);
  const renderer = new Renderer(service);

  // Exact language selectors and one delayed replacement retain precedence over late providers.
  const registered = new Map<string, Disposable>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const registerForLanguages = () => {
    for (const { document } of window.visibleTextEditors) {
      const { languageId } = document;
      if (registered.has(languageId)) continue;

      const register = () => {
        registered.get(languageId)?.dispose();
        registered.set(languageId, languages.registerFoldingRangeProvider({ language: languageId }, provider));
        renderer.schedule();
      };

      register();
      const timer = setTimeout(() => {
        timers.delete(timer);
        register();
      }, 2000);

      timers.add(timer);
    }
  };

  const refresh = () => {
    service.invalidateAll();
    provider.refresh();
    renderer.schedule();
  };

  const reload = () => {
    tokenizer.evictAll();
    refresh();
  };

  context.subscriptions.push(
    renderer,
    provider,
    grammars,
    {
      dispose: () => {
        for (const timer of timers) clearTimeout(timer);
        for (const registration of registered.values()) registration.dispose();
      },
    },

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
      service.invalidate(doc.uri);
    }),

    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("foldingLens")) {
        refresh();
      }
    }),

    window.onDidChangeTextEditorVisibleRanges((e) => {
      void renderer.updateNow(e.textEditor);
    }),

    window.onDidChangeVisibleTextEditors(() => {
      registerForLanguages();
      renderer.schedule();
    }),
  );

  registerExplorerRecursiveCommands(context);
  registerForLanguages();
  renderer.schedule();
}
