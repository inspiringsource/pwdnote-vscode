import * as vscode from 'vscode';
import {
  CliNotFoundError,
  getWorkspaceCwd,
  noWorkspaceMessage,
  runPwdnote,
  showCliRequired,
} from '../cli';
import { logError, logInfo, showLog } from '../log';

/**
 * `pwdnote: Show Status` -> runs `pwdnote status` and shows the output.
 *
 * `pwdnote status` reports the project root, note file path, and encryption
 * status — metadata only, not decrypted content — so it is safe to display and
 * to write to the output channel.
 */
export async function showStatus(): Promise<void> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    noWorkspaceMessage();
    return;
  }

  try {
    logInfo('Running: pwdnote status');
    const result = await runPwdnote(['status'], cwd);
    const output = `${result.stdout}${result.stderr}`.trim();

    logInfo('--- pwdnote status ---');
    if (output.length > 0) {
      logInfo(output);
    }
    logInfo('----------------------');
    showLog();

    if (result.code !== 0) {
      logError(`status exited with code ${result.code}`);
      void vscode.window.showErrorMessage('pwdnote: status reported a problem. See output.');
    }
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      await showCliRequired();
      return;
    }
    logError(`status threw: ${(err as Error).message}`);
    void vscode.window.showErrorMessage('pwdnote: status failed unexpectedly. See output.');
  }
}
