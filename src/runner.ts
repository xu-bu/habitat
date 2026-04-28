import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const TERMINAL_NAME = "Habitat";

/**
 * Check if a directory contains __init__.py
 */
function hasInitPy(dir: string): boolean {
  try {
    return fs.existsSync(path.join(dir, "__init__.py"));
  } catch {
    return false;
  }
}

/**
 * Find the Python project root by walking up from the file's directory.
 * Returns the first directory without __init__.py (or the original dir if none found).
 */
function findPythonProjectRoot(filePath: string): string {
  const fileDir = path.dirname(filePath);

  if (!hasInitPy(fileDir)) {
    return fileDir;
  }

  let current = fileDir;
  while (current !== path.dirname(current)) {
    const parent = path.dirname(current);
    if (!hasInitPy(parent)) {
      return parent;
    }
    current = parent;
  }

  return current;
}

/**
 * Convert a file path to a Python module name.
 * Example: /home/user/project/tools/script.py -> tools.script
 */
function filePathToModuleName(filePath: string, projectRoot: string): string {
  let relPath = path.relative(projectRoot, filePath);
  // Remove .py extension
  relPath = relPath.replace(/\.py$/, "");
  // Replace path separators with dots
  return relPath.replace(/[\/\\]/g, ".");
}

/**
 * Get Python run configuration using package-aware module execution.
 */
function getPythonRunConfig(
  filePath: string,
  pythonCmd: string,
): { cmd: string; args: string[]; cwd: string } {
  const fileDir = path.dirname(filePath);

  if (hasInitPy(fileDir)) {
    const projectRoot = findPythonProjectRoot(filePath);
    const moduleName = filePathToModuleName(filePath, projectRoot);
    return {
      cmd: pythonCmd,
      args: ["-m", moduleName],
      cwd: projectRoot,
    };
  }

  return {
    cmd: pythonCmd,
    args: [filePath],
    cwd: fileDir,
  };
}

/**
 * Detect the language/runtime from a file extension and return the run command.
 */
function getRunCommand(
  filePath: string,
  workspaceFolder: string,
): { cmd: string; args: string[]; cwd?: string } | null {
  const ext = path.extname(filePath).toLowerCase();
  const config = vscode.workspace.getConfiguration("habitat");

  switch (ext) {
    case ".py":
      return getPythonRunConfig(
        filePath,
        config.get<string>("pythonCommand", "python"),
      );
    case ".js":
    case ".mjs":
    case ".cjs":
      // Check if it's a test file
      if (filePath.toLowerCase().includes("test.js")) {
        return {
          cmd: "yarn",
          args: ["test"],
          cwd: workspaceFolder,
        };
      }
      return { cmd: "node", args: [filePath], cwd: path.dirname(filePath) };
    case ".ts":
    case ".mts":
    case ".cts":
      return {
        cmd: config.get<string>("typescriptRunner", "npx tsx"),
        args: [filePath],
        cwd: path.dirname(filePath),
      };
    case ".go":
      return {
        cmd: "go",
        args: ["run", filePath],
        cwd: path.dirname(filePath),
      };
    default:
      return { cmd: filePath, args: [], cwd: path.dirname(filePath) };
  }
}

/**
 * Find or create the Habitat terminal.
 */
function getOrCreateTerminal(env: Record<string, string>): vscode.Terminal {
  // Dispose existing Habitat terminal so env vars are fresh
  const existing = vscode.window.terminals.find(
    (t) => t.name === TERMINAL_NAME,
  );
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
export function runFile(
  filePath: string,
  env: Record<string, string>,
  extraArgs: string[] = [],
  workspaceFolder?: string,
): void {
  const runInfo = getRunCommand(
    filePath,
    workspaceFolder || path.dirname(filePath),
  );

  if (!runInfo) {
    const ext = path.extname(filePath);
    vscode.window.showErrorMessage(
      `Habitat: Unsupported file type "${ext}". Supported: .py, .js, .ts, .go`,
    );
    return;
  }

  const terminal = getOrCreateTerminal(env);
  terminal.show(true);

  const allArgs = [...runInfo.args, ...extraArgs];

  // Build the full command string
  let fullCommand = "";

  // If we have a working directory different from current, cd into it first
  if (runInfo.cwd) {
    fullCommand += `cd "${runInfo.cwd}" && `;
  }

  fullCommand += `${runInfo.cmd} ${allArgs.map((a) => `"${a}"`).join(" ")}`;

  // Small delay to let the terminal initialize
  setTimeout(() => {
    terminal.sendText(fullCommand);
  }, 300);
}

/**
 * Get the list of supported file extensions for display purposes.
 */
export function getSupportedExtensions(): string[] {
  return [".py", ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".go"];
}
