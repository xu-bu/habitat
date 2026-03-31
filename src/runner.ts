import * as vscode from 'vscode';
import * as path from 'path';

const TERMINAL_NAME = 'Habitat';

/**
 * Detect the language/runtime from a file extension and return the run command.
 */
function getRunCommand(filePath: string): { cmd: string; args: string[] } | null {
  const ext = path.extname(filePath).toLowerCase();
  const config = vscode.workspace.getConfiguration('habitat');

  switch (ext) {
    case '.py':
      return {
        cmd: config.get<string>('pythonCommand', 'python'),
        args: [filePath],
      };
    case '.js':
    case '.mjs':
    case '.cjs':
      return { cmd: 'node', args: [filePath] };
    case '.ts':
    case '.mts':
    case '.cts':
      return {
        cmd: config.get<string>('typescriptRunner', 'npx tsx'),
        args: [filePath],
      };
    case '.go':
      return { cmd: 'go', args: ['run', filePath] };
    default:
      return null;
  }
}

/**
 * Find or create the Habitat terminal.
 */
function getOrCreateTerminal(env: Record<string, string>): vscode.Terminal {
  // Dispose existing Habitat terminal so env vars are fresh
  const existing = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME);
  if (existing) {
    existing.dispose();
  }

  return vscode.window.createTerminal({
    name: TERMINAL_NAME,
    env,
  });
}

/**
 * Run the given file in an integrated terminal with the specified environment variables.
 */
export function runFile(filePath: string, env: Record<string, string>, extraArgs: string[] = []): void {
  const runInfo = getRunCommand(filePath);

  if (!runInfo) {
    const ext = path.extname(filePath);
    vscode.window.showErrorMessage(
      `Habitat: Unsupported file type "${ext}". Supported: .py, .js, .ts, .go`
    );
    return;
  }

  const terminal = getOrCreateTerminal(env);
  terminal.show(true);

  const allArgs = [...runInfo.args, ...extraArgs];

  // Build the full command string
  const fullCommand = `${runInfo.cmd} ${allArgs.map(a => `"${a}"`).join(' ')}`;

  // Small delay to let the terminal initialize
  setTimeout(() => {
    terminal.sendText(fullCommand);
  }, 300);
}

/**
 * Get the list of supported file extensions for display purposes.
 */
export function getSupportedExtensions(): string[] {
  return ['.py', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.go'];
}
