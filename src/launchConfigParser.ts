import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface LaunchConfig {
  name: string;
  env: Record<string, string>;
  args: string[];
  program?: string;
}


/**
 * Resolve VS Code variables in a string (limited subset).
 */
function resolveVariables(value: string, workspaceFolder: string): string {
  return value
    .replace(/\$\{workspaceFolder\}/g, workspaceFolder)
    .replace(/\$\{cwd\}/g, workspaceFolder)
    .replace(/\$\{env:(\w+)\}/g, (_, envVar) => process.env[envVar] || '');
}

/**
 * Strip JSON comments and trailing commas (JSONC → JSON).
 * String-aware: won't strip // or /* inside quoted strings.
 */
function stripJsonComments(text: string): string {
  let result = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    // Handle strings — pass through untouched
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < len) {
        const sc = text[i];
        str += sc;
        i++;
        if (sc === '\\' && i < len) {
          // escaped character, include it and skip
          str += text[i];
          i++;
        } else if (sc === '"') {
          break;
        }
      }
      result += str;
      continue;
    }

    // Handle single-line comments
    if (ch === '/' && i + 1 < len && text[i + 1] === '/') {
      // Skip until end of line
      i += 2;
      while (i < len && text[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Handle multi-line comments
    if (ch === '/' && i + 1 < len && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < len && !(text[i] === '*' && text[i + 1] === '/')) {
        i++;
      }
      i += 2; // skip */
      continue;
    }

    result += ch;
    i++;
  }

  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([\]}])/g, '$1');

  return result;
}

/**
 * Read and parse all configurations from .vscode/launch.json.
 * Returns only configurations that have `env` fields.
 */
export function getConfigurations(workspaceFolder: string): LaunchConfig[] {
  const launchJsonPath = path.join(workspaceFolder, '.vscode', 'launch.json');

  if (!fs.existsSync(launchJsonPath)) {
    return [];
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(launchJsonPath, 'utf-8');
  } catch (err) {
    vscode.window.showErrorMessage(`Habitat: Failed to read launch.json: ${err}`);
    return [];
  }

  let launchJson: any;
  try {
    const cleanJson = stripJsonComments(rawContent);
    launchJson = JSON.parse(cleanJson);
  } catch (err) {
    vscode.window.showErrorMessage(`Habitat: Failed to parse launch.json: ${err}`);
    return [];
  }

  const configurations: LaunchConfig[] = [];

  if (!Array.isArray(launchJson.configurations)) {
    return [];
  }

  for (const config of launchJson.configurations) {
    if (!config.name) {
      continue;
    }

    let env: Record<string, string> = {};

    // Merge inline env
    if (config.env && typeof config.env === 'object') {
      for (const [key, value] of Object.entries(config.env)) {
        if (typeof value === 'string') {
          env[key] = resolveVariables(value, workspaceFolder);
        }
      }
    }

    // Extract args
    let args: string[] = [];
    if (Array.isArray(config.args)) {
      args = config.args.map((a: any) => String(a));
    }

    let program: string | undefined;
    if (typeof config.program === 'string') {
      program = config.program;
    }

    // Include configs that have env vars or args or program
    if (Object.keys(env).length > 0 || args.length > 0 || program) {
      configurations.push({
        name: config.name,
        env,
        args,
        program,
      });
    }
  }

  return configurations;
}
