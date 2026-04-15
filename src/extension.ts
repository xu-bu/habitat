import * as vscode from "vscode";
import * as path from "path";
import { SidebarViewProvider } from "./sidebarViewProvider";
import { getConfigurations } from "./launchConfigParser";
import { runFile } from "./runner";

let sidebarProvider: SidebarViewProvider;
let outputChannel: vscode.OutputChannel;

function log(msg: string): void {
  outputChannel.appendLine(`[Habitat] ${msg}`);
  console.log(`[Habitat] ${msg}`);
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("Habitat");
  context.subscriptions.push(outputChannel);

  log("Extension activating...");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  log(`Workspace folder: ${workspaceFolder || "NONE"}`);

  const extensionVersion = context.extension.packageJSON.version;
  // Create sidebar provider
  sidebarProvider = new SidebarViewProvider(
    context.extensionUri,
    extensionVersion,
  );

  // Register the webview view provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarViewProvider.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // Load configurations initially
  if (workspaceFolder) {
    refreshConfigs(workspaceFolder);
  } else {
    log("WARNING: No workspace folder found. launch.json cannot be read.");
  }

  // Watch launch.json for changes
  if (workspaceFolder) {
    const launchJsonPattern = new vscode.RelativePattern(
      workspaceFolder,
      ".vscode/launch.json",
    );
    const watcher = vscode.workspace.createFileSystemWatcher(launchJsonPattern);

    watcher.onDidChange(() => refreshConfigs(workspaceFolder));
    watcher.onDidCreate(() => refreshConfigs(workspaceFolder));
    watcher.onDidDelete(() => sidebarProvider.updateConfigs([]));

    context.subscriptions.push(watcher);
  }

  // Register the run command (triggered by keybinding or sidebar button)
  context.subscriptions.push(
    vscode.commands.registerCommand("habitat.run", () => {
      executeRun(workspaceFolder);
    }),
  );

  // Register the refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand("habitat.refresh", () => {
      if (workspaceFolder) {
        refreshConfigs(workspaceFolder);
        vscode.window.showInformationMessage(
          "Habitat: Configurations refreshed",
        );
      }
    }),
  );

  // Wire sidebar run button to the same handler
  sidebarProvider.onRunRequested = () => {
    executeRun(workspaceFolder);
  };

  // Wire sidebar edit button to open launch.json
  sidebarProvider.onEditRequested = (configName) => {
    if (!workspaceFolder) {
      vscode.window.showErrorMessage(
        "Habitat: No workspace folder found to open launch.json",
      );
      return;
    }

    const launchJsonPath = path.join(workspaceFolder, ".vscode", "launch.json");
    vscode.workspace.openTextDocument(launchJsonPath).then(
      (doc) => {
        vscode.window.showTextDocument(doc).then((editor) => {
          // Find the configuration string in the file and select it
          const text = doc.getText();
          const configIndex = text.indexOf(`"name": "${configName}"`);
          if (configIndex !== -1) {
            const position = doc.positionAt(configIndex);
            // highlight the "name": "XYZ" line
            const matchLength = `"name": "${configName}"`.length;
            const endPosition = doc.positionAt(configIndex + matchLength);
            const range = new vscode.Range(position, endPosition);
            editor.selection = new vscode.Selection(position, endPosition);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
          }
        });
      },
      (err) => {
        vscode.window.showErrorMessage(
          `Habitat: Failed to open launch.json: ${err}`,
        );
      },
    );
  };

  // Also watch for workspace folder changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const newFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (newFolder) {
        refreshConfigs(newFolder);
      }
    }),
  );
}

/**
 * Refresh configurations from launch.json and update the sidebar.
 */
function refreshConfigs(workspaceFolder: string): void {
  log(`Refreshing configs from: ${workspaceFolder}`);
  const configs = getConfigurations(workspaceFolder);
  log(
    `Found ${configs.length} configs with env vars: ${configs.map((c) => c.name).join(", ") || "(none)"}`,
  );
  sidebarProvider.updateConfigs(configs);
}

/**
 * Execute the run command: get the active file and run it with the selected env.
 */
function executeRun(workspaceFolder: string | undefined): void {
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    vscode.window.showWarningMessage("Habitat: No active file to run");
    return;
  }

  const filePath = activeEditor.document.fileName;
  log(`Active file: ${filePath}`);

  const selectedConfig = sidebarProvider.getSelectedConfig();
  log(`Selected config: ${selectedConfig?.name || "NONE"}`);

  if (!selectedConfig) {
    vscode.window.showWarningMessage(
      "Habitat: No environment configuration selected. Add env fields to your .vscode/launch.json.",
    );
    return;
  }

  log(`Env vars: ${JSON.stringify(selectedConfig.env)}`);

  // Save the file before running
  activeEditor.document.save().then(() => {
    let targetFile = filePath;
    if (selectedConfig.program) {
      targetFile = resolveVariables(
        selectedConfig.program,
        workspaceFolder || "",
        filePath,
      );
    }

    const resolvedArgs = (selectedConfig.args || []).map((arg) =>
      resolveVariables(arg, workspaceFolder || "", filePath),
    );

    log(
      `Running: ${targetFile} with config "${selectedConfig.name}" and args: [${resolvedArgs.join(", ")}]`,
    );
    runFile(targetFile, selectedConfig.env, resolvedArgs, workspaceFolder);

    const envCount = Object.keys(selectedConfig.env).length;
    const argsCount = resolvedArgs.length;
    vscode.window.setStatusBarMessage(
      `Habitat: Running with "${selectedConfig.name}" (${envCount} env vars, ${argsCount} args)`,
      3000,
    );
  });
}

function resolveVariables(
  str: string,
  workspaceFolder: string,
  activeFilePath: string,
): string {
  const fileBasename = path.basename(activeFilePath);
  const fileDirname = path.dirname(activeFilePath);
  const relativeFile = path.relative(workspaceFolder, activeFilePath);
  const relativeFileDirname = path.dirname(relativeFile);

  return str
    .replace(/\$\{workspaceFolder\}/g, workspaceFolder)
    .replace(/\$\{file\}/g, activeFilePath)
    .replace(/\$\{fileBasename\}/g, fileBasename)
    .replace(/\$\{fileDirname\}/g, fileDirname)
    .replace(/\$\{relativeFile\}/g, relativeFile)
    .replace(/\$\{relativeFileDirname\}/g, relativeFileDirname);
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
