import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { logError } from './log';

export const CLI_NAME = 'pwdnote';

export const INSTALL_HINT = 'uv tool install pwdnote';
export const UPGRADE_HINT = 'uv tool upgrade pwdnote';
export const CLI_REQUIRED_MESSAGE = 'pwdnote CLI is required.';

/** Minimum CLI version exposing read / write --stdin / root / note-path. */
export const MIN_CLI_VERSION = '0.3.0';
export const CLI_VERSION_REQUIRED_MESSAGE = 'pwdnote CLI 0.3.0 or newer is required.';

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
export function runPwdnote(
  args: string[],
  cwd: string,
  input?: string,
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(
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

    // Feed stdin for commands like `write --stdin`. We always close stdin so a
    // command that reads it gets EOF and never blocks. The piped content may be
    // plaintext note data; it is written to the child process only and is never
    // logged or persisted to disk by the extension.
    if (child.stdin) {
      if (input !== undefined) {
        child.stdin.write(input);
      }
      child.stdin.end();
    }
  });
}

/**
 * Parse the installed CLI version from `pwdnote --version`
 * (e.g. "pwdnote 0.3.0" -> [0, 3, 0]). Returns undefined when the binary is
 * present but the version string cannot be parsed.
 */
export async function getCliVersion(cwd: string): Promise<[number, number, number] | undefined> {
  const result = await runPwdnote(['--version'], cwd);
  const match = `${result.stdout}\n${result.stderr}`.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Compare a parsed version against MIN_CLI_VERSION (0.3.0). */
export function meetsMinVersion(version: [number, number, number]): boolean {
  const min = MIN_CLI_VERSION.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (version[i] > min[i]) {
      return true;
    }
    if (version[i] < min[i]) {
      return false;
    }
  }
  return true; // equal
}

/**
 * Ensure the CLI is installed AND new enough for the read/write integration.
 * Shows the appropriate message (with install + upgrade hints) and returns false
 * when the requirement is not met. Use before any read/edit/save flow.
 */
export async function ensureCliReady(cwd: string): Promise<boolean> {
  let version: [number, number, number] | undefined;
  try {
    version = await getCliVersion(cwd);
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      await showCliVersionRequired();
      return false;
    }
    throw err;
  }

  if (!version || !meetsMinVersion(version)) {
    logError(
      `pwdnote version ${version ? version.join('.') : 'unknown'} is below required ${MIN_CLI_VERSION}`,
    );
    await showCliVersionRequired();
    return false;
  }
  return true;
}

/** Show the "0.3.0 or newer required" message with install + upgrade hints. */
export async function showCliVersionRequired(): Promise<void> {
  const copyInstall = 'Copy install command';
  const copyUpgrade = 'Copy upgrade command';
  const choice = await vscode.window.showErrorMessage(
    `${CLI_VERSION_REQUIRED_MESSAGE}  Install: ${INSTALL_HINT}   •   Update: ${UPGRADE_HINT}`,
    copyInstall,
    copyUpgrade,
  );
  if (choice === copyInstall) {
    await vscode.env.clipboard.writeText(INSTALL_HINT);
    void vscode.window.showInformationMessage('Copied: ' + INSTALL_HINT);
  } else if (choice === copyUpgrade) {
    await vscode.env.clipboard.writeText(UPGRADE_HINT);
    void vscode.window.showInformationMessage('Copied: ' + UPGRADE_HINT);
  }
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
