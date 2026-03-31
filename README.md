# Habitat

A VS Code / Open VSX extension that lets you run your code with environment variables and arguments defined directly in your `.vscode/launch.json` configurations.

Instead of writing custom scripts or manually sourcing `.env` files every time you want to run a quick test, **Habitat** provides a dedicated sidebar panel where you can choose an environment configuration and run your currently active file with one click (or shortcut).

## Features

- **Sidebar Panel:** Adds a "Habitat" icon to your Activity Bar with a clean, native-looking dropdown.
- **launch.json Integration:** Automatically reads your existing `.vscode/launch.json` and extracts `env` and `args` fields.
- **Language Support:** Automatically detects the language of your active file completely out-of-the-box:
  - `.py` (Python)
  - `.js`, `.mjs`, `.cjs` (Node.js)
  - `.ts`, `.mts`, `.cts` (TypeScript via `npx tsx`)
  - `.go` (Go)
- **Variable Substitution:** Sustitutes standard VS Code variables like `${workspaceFolder}` and `${env:VAR_NAME}` in your configuration files.
- **Keyboard Shortcut:** Quickly run the active file using <kbd>Ctrl</kbd> + <kbd>F5</kbd> (<kbd>Cmd</kbd> + <kbd>F5</kbd> on macOS).

## Usage

1. **Add to launch.json:** Add `env` or `args` to one or more of your configurations in `.vscode/launch.json`:

   ```jsonc
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Local Development",
         "type": "node", // Ignored by Habitat
         "request": "launch", // Ignored by Habitat
         "env": {
           "LOCAL_DEBUG": "true"
         },
         "args": ["--verbose"]
       },
       {
         "name": "Staging DB",
         "type": "python",
         "request": "launch",
         "env": {
           "DB_HOST": "staging.database.net",
           "API_KEY": "${env:SECRET_API_KEY}"
         }
       }
     ]
   }
   ```

2. **Select & Run:** Open the Habitat sidebar, pick your configuration from the dropdown, and click **Run with Env** (or press `Ctrl+F5`). Ensure the file you want to run is the active tab in your editor.

## Extension Settings

You can customize the base commands used to run your files via VS Code's settings:

- `habitat.typescriptRunner`: The command used to run TypeScript files (default: `npx tsx`).
- `habitat.pythonCommand`: The command used to run Python files (default: `python`).

## License

MIT
