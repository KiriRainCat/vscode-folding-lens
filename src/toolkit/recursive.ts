import * as vscode from "vscode";

const COMMANDS = {
  expand: "foldingLens.explorer.expandRecursively",
  collapse: "foldingLens.explorer.collapseRecursively",
} as const;

const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules"]);

export function registerExplorerRecursiveCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.expand, (...args: unknown[]) => run("expand", args)),
    vscode.commands.registerCommand(COMMANDS.collapse, (...args: unknown[]) => run("collapse", args)),
  );
}

async function run(action: "expand" | "collapse", args: readonly unknown[]): Promise<void> {
  const targets = await getTargets(args);

  for (const target of targets) {
    if (action === "expand") {
      await expandRecursively(target);
    } else {
      await collapseRecursively(target);
    }
  }
}

async function getTargets(args: readonly unknown[]): Promise<vscode.Uri[]> {
  const uris = args.flatMap((arg): vscode.Uri[] => {
    if (isUri(arg)) return [arg];
    return Array.isArray(arg) ? arg.filter(isUri) : [];
  });

  const unique = [...new Map(uris.map((uri) => [uri.toString(), uri])).values()];
  const folders: vscode.Uri[] = [];

  for (const uri of unique) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (isDirectory(stat.type)) folders.push(uri);
    } catch {
      // Ignore stale or inaccessible Explorer selections.
    }
  }

  // A selected parent already includes any selected descendants.
  return folders
    .sort((a, b) => a.path.length - b.path.length)
    .filter((uri, index, all) => !all.slice(0, index).some((parent) => isParentOf(parent, uri)));
}

async function expandRecursively(root: vscode.Uri): Promise<void> {
  const stack = [root];

  while (stack.length > 0) {
    const folder = stack.pop()!;

    // Expand the focused Explorer item. These are internal VS Code commands.
    try {
      await vscode.commands.executeCommand("revealInExplorer", folder);
      await vscode.commands.executeCommand("list.expand");
    } catch {
      // Keep traversing; a later descendant may still be revealable.
    }

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(folder);
    } catch {
      continue;
    }

    const children = entries
      .filter(([name, type]) => isDirectory(type) && !EXCLUDED_DIRECTORIES.has(name.toLowerCase()))
      .map(([name]) => vscode.Uri.joinPath(folder, name));

    // Reverse push keeps the provider's original order during depth-first traversal.
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]!);
    }
  }
}

async function collapseRecursively(root: vscode.Uri): Promise<void> {
  try {
    await vscode.commands.executeCommand("revealInExplorer", root);
    await vscode.commands.executeCommand("list.collapseAllToFocus");
  } catch {
    // Ignore resources that the Explorer can no longer reveal.
  }
}

function isUri(value: unknown): value is vscode.Uri {
  if (typeof value !== "object" || value === null) return false;
  const uri = value as Partial<vscode.Uri>;
  return typeof uri.scheme === "string" && typeof uri.path === "string" && typeof uri.toString === "function";
}

function isDirectory(type: vscode.FileType): boolean {
  return (type & vscode.FileType.Directory) !== 0 && (type & vscode.FileType.SymbolicLink) === 0;
}

function isParentOf(parent: vscode.Uri, child: vscode.Uri): boolean {
  if (parent.scheme !== child.scheme || parent.authority !== child.authority) {
    return false;
  }

  const parentPath = parent.path.replace(/\/+$/, "") || "/";
  return parentPath === "/" ? child.path.startsWith("/") : child.path.startsWith(`${parentPath}/`);
}
