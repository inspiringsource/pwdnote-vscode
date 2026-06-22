import * as vscode from 'vscode';
import {
  CliNotFoundError,
  getWorkspaceCwd,
  noWorkspaceMessage,
  runPwdnote,
  showCliRequired,
} from '../cli';
import { logError, logInfo, showLog } from '../log';

/** `pwdnote: Initialize Project Note` -> runs `pwdnote init`. */
export async function initNote(): Promise<void> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    noWorkspaceMessage();
    return;
  }

  try {
    logInfo('Running: pwdnote init');
    const result = await runPwdnote(['init'], cwd);
    if (result.code === 0) {
      void vscode.window.showInformationMessage('pwdnote: project note initialized.');
    } else {
      logError(`init exited with code ${result.code}: ${result.stderr.trim()}`);
      void vscode.window
        .showErrorMessage('pwdnote: init failed. See output for details.', 'Show Output')
        .then((c) => c === 'Show Output' && showLog());
    }
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      await showCliRequired();
      return;
    }
    logError(`init threw: ${(err as Error).message}`);
    void vscode.window.showErrorMessage('pwdnote: init failed unexpectedly. See output.');
  }
}
