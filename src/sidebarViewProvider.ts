import * as vscode from 'vscode';
import { LaunchConfig } from './launchConfigParser';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'habitat.sidebarView';

  private _view?: vscode.WebviewView;
  private _configs: LaunchConfig[] = [];
  private _selectedConfigName: string | null = null;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /**
   * Update the configurations displayed in the dropdown.
   */
  public updateConfigs(configs: LaunchConfig[]): void {
    this._configs = configs;

    // If selected config no longer exists, reset
    if (this._selectedConfigName && !configs.find((c) => c.name === this._selectedConfigName)) {
      this._selectedConfigName = configs.length > 0 ? configs[0].name : null;
    }

    // If nothing selected yet, default to first
    if (!this._selectedConfigName && configs.length > 0) {
      this._selectedConfigName = configs[0].name;
    }

    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateConfigs',
        configs: configs.map((c) => c.name),
        selected: this._selectedConfigName,
      });
    }
  }

  /**
   * Get the currently selected configuration.
   */
  public getSelectedConfig(): LaunchConfig | undefined {
    return this._configs.find((c) => c.name === this._selectedConfigName);
  }

  /**
   * Get the selected config name.
   */
  public getSelectedConfigName(): string | null {
    return this._selectedConfigName;
  }

  /**
   * Called when a run is triggered externally (e.g. via keybinding).
   */
  public onRunRequested?: () => void;

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'run':
          this._selectedConfigName = message.configName;
          if (this.onRunRequested) {
            this.onRunRequested();
          }
          break;
        case 'selectConfig':
          this._selectedConfigName = message.configName;
          break;
        case 'ready':
          // Webview loaded, send current configs
          this.updateConfigs(this._configs);
          break;
      }
    });
  }

  private _getHtmlForWebview(): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
      padding: 12px 16px;
    }

    .section {
      margin-bottom: 16px;
    }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }

    .config-select {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      outline: none;
      cursor: pointer;
      appearance: auto;
    }

    .config-select:focus {
      border-color: var(--vscode-focusBorder);
    }

    .config-select:hover {
      background: var(--vscode-dropdown-background);
    }

    .run-btn {
      width: 100%;
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.1s ease;
    }

    .run-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .run-btn:active {
      transform: scale(0.98);
    }

    .run-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .run-btn .play-icon {
      width: 14px;
      height: 14px;
    }

    .empty-state {
      text-align: center;
      padding: 24px 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.5;
    }

    .empty-state code {
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
    }

    .env-preview {
      margin-top: 12px;
      padding: 8px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      line-height: 1.6;
      max-height: 200px;
      overflow-y: auto;
      word-break: break-all;
    }

    .env-preview .env-key {
      color: var(--vscode-debugTokenExpression-name);
    }

    .env-preview .env-value {
      color: var(--vscode-debugTokenExpression-string);
    }

    .shortcut-hint {
      text-align: center;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }

    .shortcut-hint kbd {
      background: var(--vscode-keybindingLabel-background);
      color: var(--vscode-keybindingLabel-foreground);
      border: 1px solid var(--vscode-keybindingLabel-border);
      border-bottom: 2px solid var(--vscode-keybindingLabel-bottomBorder, var(--vscode-keybindingLabel-border));
      border-radius: 3px;
      padding: 1px 5px;
      font-family: var(--vscode-font-family);
      font-size: 10px;
    }

    .status-bar {
      margin-top: 12px;
      padding: 6px 8px;
      border-radius: 3px;
      font-size: 11px;
      display: none;
    }

    .status-bar.success {
      display: block;
      background: var(--vscode-inputValidation-infoBackground, rgba(0, 122, 204, 0.1));
      border: 1px solid var(--vscode-inputValidation-infoBorder, #007acc);
    }
  </style>
</head>
<body>
  <div id="main-content">
    <div class="section">
      <div class="section-label">Environment</div>
      <select class="config-select" id="configSelect">
        <option value="">Loading...</option>
      </select>
    </div>

    <div class="section">
      <button class="run-btn" id="runBtn" disabled>
        <svg class="play-icon" viewBox="0 0 16 16" fill="currentColor">
          <polygon points="3,1.5 13,8 3,14.5"/>
        </svg>
        Run with Env
      </button>
      <div class="shortcut-hint">
        <kbd>Ctrl</kbd> + <kbd>F5</kbd>
        <div class="command-id">habitat.run</div>
      </div>
    </div>

    <div id="envPreview" class="env-preview" style="display: none;"></div>
  </div>

  <div id="emptyState" class="empty-state" style="display: none;">
    No environment configurations found.<br><br>
    Add <code>env</code> fields to your<br>
    <code>.vscode/launch.json</code> configurations.
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const configSelect = document.getElementById('configSelect');
    const runBtn = document.getElementById('runBtn');
    const envPreview = document.getElementById('envPreview');
    const mainContent = document.getElementById('main-content');
    const emptyState = document.getElementById('emptyState');

    let configs = [];
    let configEnvs = {};

    // Handle messages from the extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.command) {
        case 'updateConfigs':
          configs = message.configs || [];
          updateDropdown(configs, message.selected);
          break;
        case 'showEnvPreview':
          showEnvVars(message.env);
          break;
      }
    });

    function updateDropdown(configNames, selected) {
      configSelect.innerHTML = '';

      if (configNames.length === 0) {
        mainContent.style.display = 'none';
        emptyState.style.display = 'block';
        runBtn.disabled = true;
        return;
      }

      mainContent.style.display = 'block';
      emptyState.style.display = 'none';
      runBtn.disabled = false;

      configNames.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (name === selected) {
          option.selected = true;
        }
        configSelect.appendChild(option);
      });
    }

    function showEnvVars(env) {
      if (!env || Object.keys(env).length === 0) {
        envPreview.style.display = 'none';
        return;
      }

      envPreview.style.display = 'block';
      envPreview.innerHTML = Object.entries(env)
        .map(
          ([key, value]) =>
            '<span class="env-key">' + escapeHtml(key) + '</span>=<span class="env-value">' + escapeHtml(String(value)) + '</span>'
        )
        .join('<br>');
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Run button click
    runBtn.addEventListener('click', () => {
      const configName = configSelect.value;
      if (configName) {
        vscode.postMessage({ command: 'run', configName });
      }
    });

    // Config selection change
    configSelect.addEventListener('change', () => {
      const configName = configSelect.value;
      vscode.postMessage({ command: 'selectConfig', configName });
    });

    // Tell extension we're ready
    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
  }
}
