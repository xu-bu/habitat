import * as vscode from 'vscode';
import { SidebarViewProvider } from './sidebarViewProvider';
import { getConfigurations } from './launchConfigParser';
import { runFile } from './runner';

let sidebarProvider: SidebarViewProvider;
let outputChannel: vscode.OutputChannel;

function log(msg: string): void {
  outputChannel.appendLine(`[Habitat] ${msg}`);
  console.log(`[Habitat] ${msg}`);
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Habitat');
  context.subscriptions.push(outputChannel);

  log('Extension activating...');

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  log(`Workspace folder: ${workspaceFolder || 'NONE'}`);

  // Create sidebar provider
  sidebarProvider = new SidebarViewProvider(context.extensionUri);

  // Register the webview view provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarViewProvider.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Load configurations initially
  if (workspaceFolder) {
    refreshConfigs(workspaceFolder);
  } else {
    log('WARNING: No workspace folder found. launch.json cannot be read.');
  }

  // Watch launch.json for changes
  if (workspaceFolder) {
    const launchJsonPattern = new vscode.RelativePattern(workspaceFolder, '.vscode/launch.json');
    const watcher = vscode.workspace.createFileSystemWatcher(launchJsonPattern);

    watcher.onDidChange(() => refreshConfigs(workspaceFolder));
    watcher.onDidCreate(() => refreshConfigs(workspaceFolder));
    watcher.onDidDelete(() => sidebarProvider.updateConfigs([]));

    context.subscriptions.push(watcher);
  }

  // Register the run command (triggered by keybinding or sidebar button)
  context.subscriptions.push(
    vscode.commands.registerCommand('habitat.run', () => {
      executeRun(workspaceFolder);
    })
  );

  // Register the refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('habitat.refresh', () => {
      if (workspaceFolder) {
        refreshConfigs(workspaceFolder);
        vscode.window.showInformationMessage('Habitat: Configurations refreshed');
      }
    })
  );

  // Wire sidebar run button to the same handler
  sidebarProvider.onRunRequested = () => {
    executeRun(workspaceFolder);
  };

  // Also watch for workspace folder changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const newFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (newFolder) {
        refreshConfigs(newFolder);
      }
    })
  );
}

/**
 * Refresh configurations from launch.json and update the sidebar.
 */
function refreshConfigs(workspaceFolder: string): void {
  log(`Refreshing configs from: ${workspaceFolder}`);
  const configs = getConfigurations(workspaceFolder);
  log(`Found ${configs.length} configs with env vars: ${configs.map(c => c.name).join(', ') || '(none)'}`);
  sidebarProvider.updateConfigs(configs);
}

/**
 * Execute the run command: get the active file and run it with the selected env.
 */
function executeRun(workspaceFolder: string | undefined): void {
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    vscode.window.showWarningMessage('Habitat: No active file to run');
    return;
  }

  const filePath = activeEditor.document.fileName;
  log(`Active file: ${filePath}`);

  const selectedConfig = sidebarProvider.getSelectedConfig();
  log(`Selected config: ${selectedConfig?.name || 'NONE'}`);

  if (!selectedConfig) {
    vscode.window.showWarningMessage(
      'Habitat: No environment configuration selected. Add env fields to your .vscode/launch.json.'
    );
    return;
  }

  log(`Env vars: ${JSON.stringify(selectedConfig.env)}`);

  // Save the file before running
  activeEditor.document.save().then(() => {
    log(`Running: ${filePath} with config "${selectedConfig.name}" and args: [${selectedConfig.args?.join(', ') || ''}]`);
    runFile(filePath, selectedConfig.env, selectedConfig.args || []);

    const envCount = Object.keys(selectedConfig.env).length;
    const argsCount = selectedConfig.args ? selectedConfig.args.length : 0;
    vscode.window.setStatusBarMessage(
      `Habitat: Running with "${selectedConfig.name}" (${envCount} env vars, ${argsCount} args)`,
      3000
    );
  });
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
