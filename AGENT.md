# Habitat — Agent Guide

## Overview

Habitat is a VS Code / Open VSX extension that runs code files with environment variables from `launch.json` configurations. It provides a sidebar panel with an env config dropdown and a run button (keybinding: `Ctrl+F5`).

**Publisher:** `xu-bu` | **ID:** `habitat` | **Engine:** VS Code `^1.85.0`

## Project Structure

```
habitat/
├── src/
│   ├── extension.ts            # Entry point: activate/deactivate, wiring
│   ├── launchConfigParser.ts   # Reads .vscode/launch.json (JSONC), parses env/envFile
│   ├── runner.ts               # Detects file type & runs in integrated terminal
│   └── sidebarViewProvider.ts  # WebviewViewProvider with inline HTML/CSS/JS
├── resources/
│   └── icon.svg                # Activity bar icon (play + gear)
├── dist/                       # esbuild output (gitignored)
├── esbuild.js                  # Bundler config
├── package.json                # Extension manifest & contributions
├── tsconfig.json               # TypeScript config (ES2020, commonjs)
└── .vscodeignore               # Files excluded from VSIX
```

## Architecture

- **Sidebar UI** is a `WebviewViewProvider` with inline HTML (no framework). It uses `--vscode-*` CSS variables for native theme integration.
- **Message passing**: Webview ↔ Extension Host via `postMessage` / `onDidReceiveMessage`.
- **launch.json** is parsed with a custom JSONC stripper (handles comments, trailing commas). No external dependency needed.
- **File execution** uses `vscode.window.createTerminal()` with env injection. Terminal is disposed and recreated on each run to ensure fresh env vars.
- **FileSystemWatcher** on `.vscode/launch.json` auto-refreshes configs on change.

## Supported Languages

| Extension         | Command                          | Configurable |
|-------------------|----------------------------------|--------------|
| `.py`             | `python <file>`                  | `habitat.pythonCommand` setting |
| `.js` `.mjs` `.cjs` | `node <file>`                 | No |
| `.ts` `.mts` `.cts` | `npx tsx <file>`              | `habitat.typescriptRunner` setting |
| `.go`             | `go run <file>`                  | No |

## Commands

| Command ID        | Title                                     | Keybinding |
|-------------------|-------------------------------------------|------------|
| `habitat.run`     | Run Active File with Selected Env         | `Ctrl+F5` / `Cmd+F5` |
| `habitat.refresh` | Refresh Configurations                    | — |

## Development

```bash
# Install dependencies
npm install

# Compile (dev, with sourcemaps)
npm run compile

# Watch mode (auto-rebuild on change)
npm run watch

# Production build (minified, no sourcemaps)
npm run build

# Package VSIX
npx @vscode/vsce package --no-dependencies --allow-missing-repository

# Debug: press F5 in VS Code to launch Extension Development Host
```

## Key Design Decisions

1. **esbuild** over webpack — faster builds, simpler config, single output file.
2. **Inline HTML** in `sidebarViewProvider.ts` — avoids file loading complexity for a small UI. All CSS uses VS Code theme variables so it adapts to any theme automatically.
3. **Terminal disposal + recreation** on each run — ensures env vars are cleanly applied (VS Code terminals inherit env at creation time, not at command time).
4. **JSONC parsing** is hand-rolled (regex-based comment/comma stripping) to avoid adding a dependency for a simple task.
5. **envFile** is merged with lower priority than inline `env` — matching VS Code's own debugger behavior.
6. **No `activationEvents`** — VS Code `^1.74.0+` auto-generates them from `contributes`.

## launch.json Format

The extension reads configurations that have `env` and/or `envFile` fields:

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Development",       // ← shown in dropdown
      "type": "node",              // ← ignored by Habitat
      "request": "launch",        // ← ignored by Habitat
      "env": {                    // ← extracted
        "NODE_ENV": "development",
        "API_URL": "http://localhost:3000"
      }
    },
    {
      "name": "Production",
      "type": "node",
      "request": "launch",
      "envFile": "${workspaceFolder}/.env.production"  // ← resolved & parsed
    }
  ]
}
```

Only configs with at least one env var (from `env` or `envFile`) appear in the dropdown.

## Variable Substitution

Supported in `envFile` paths and `env` values:
- `${workspaceFolder}` — workspace root
- `${cwd}` — same as workspaceFolder
- `${env:VAR_NAME}` — host environment variable

## Publishing

```bash
# Build VSIX
npx @vscode/vsce package --no-dependencies

# Publish to Open VSX
npx ovsx publish habitat-<version>.vsix -p <OVSX_ACCESS_TOKEN>

# Publish to VS Code Marketplace
npx @vscode/vsce publish -p <VSCE_PAT>
```
