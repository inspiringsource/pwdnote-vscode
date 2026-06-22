import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { logError } from './log';

export const CLI_NAME = 'pwdnote';

export const INSTALL_HINT = 'uv tool install pwdnote';
export const CLI_REQUIRED_MESSAGE = 'pwdnote CLI is required.';

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Thrown when the pwdnote binary cannot be found in PATH (ENOENT). Distinct from
 * a non-zero exit, which is returned as a {@link CliResult}.
 */
export class CliNotFoundError extends Error {
  constructor() {
    super(CLI_REQUIRED_MESSAGE);
    this.name = 'CliNotFoundError';
  }
}

/**
 * Run the pwdnote CLI and resolve with its exit code and captured streams.
 *
 * Notes on logging / security:
 *  - This function never writes `args` or the captured streams to the output
 *    channel. `args` may contain the plaintext of a quick note, and stdout may
 *    contain decrypted content. Callers log only sanitized summaries.
 */
export function runPwdnote(args: string[], cwd: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(
      CLI_NAME,
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new CliNotFoundError());
          return;
        }
        // execFile reports a non-zero exit through `error`. We surface it as a
        // result rather than a rejection so callers can read stderr.
        const code = typeof (error as { code?: unknown })?.code === 'number'
          ? ((error as { code: number }).code)
          : error
            ? 1
            : 0;
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' });
      },
    );
  });
}

/**
 * Return true if the pwdnote CLI is resolvable in PATH. Implemented by invoking
 * `pwdnote --help`, which is cheap and side-effect free.
 */
export async function isCliAvailable(cwd: string): Promise<boolean> {
  try {
    await runPwdnote(['--help'], cwd);
    return true;
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      return false;
    }
    // Any other error still means the binary was found and executed.
    return true;
  }
}

/**
 * Parse the set of top-level subcommands the installed CLI advertises in its
 * `--help` output (e.g. "init", "add", "status"). Used for capability detection
 * so the extension can degrade gracefully when, for example, `read` is missing.
 */
export async function getCliCommands(cwd: string): Promise<Set<string>> {
  const result = await runPwdnote(['--help'], cwd);
  const text = `${result.stdout}\n${result.stderr}`;
  const commands = new Set<string>();

  // The help renders a "Commands" box of the form:
  //   │ init       Create an encrypted project note. │
  // Match the first word on each line that follows the Commands header.
  let inCommands = false;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/[│|╭╮╰╯─]/g, ' ').trim();
    if (/^Commands\b/i.test(line)) {
      inCommands = true;
      continue;
    }
    if (!inCommands) {
      continue;
    }
    const match = line.match(/^([a-z][a-z0-9-]*)\b/);
    if (match) {
      commands.add(match[1]);
    }
  }
  return commands;
}

/**
 * Resolve the workspace folder to run the CLI in. Prefers the folder of the
 * active editor, then the first workspace folder. Returns undefined (and shows a
 * message) when there is no folder open.
 */
export function getWorkspaceCwd(): string | undefined {
  const active = vscode.window.activeTextEditor?.document.uri;
  if (active) {
    const folder = vscode.workspace.getWorkspaceFolder(active);
    if (folder) {
      return folder.uri.fsPath;
    }
  }
  const first = vscode.workspace.workspaceFolders?.[0];
  if (first) {
    return first.uri.fsPath;
  }
  return undefined;
}

export function noWorkspaceMessage(): void {
  void vscode.window.showWarningMessage(
    'pwdnote: open a workspace folder first — notes are project-local.',
  );
}

/** Show the standard "CLI required" message with an install hint and copy action. */
export async function showCliRequired(): Promise<void> {
  logError(`${CLI_NAME} not found in PATH`);
  const copy = 'Copy install command';
  const choice = await vscode.window.showErrorMessage(
    `${CLI_REQUIRED_MESSAGE} Install it with: ${INSTALL_HINT}`,
    copy,
  );
  if (choice === copy) {
    await vscode.env.clipboard.writeText(INSTALL_HINT);
    void vscode.window.showInformationMessage('Copied: ' + INSTALL_HINT);
  }
}
