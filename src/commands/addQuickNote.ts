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
 * `pwdnote: Add Quick Note` -> prompts for text and runs `pwdnote add "<text>"`.
 *
 * Security: the entered text is note plaintext. It is passed to the CLI as an
 * argument but is NEVER written to the output channel or persisted by the
 * extension. Only a sanitized "added N characters" summary is logged.
 */
export async function addQuickNote(): Promise<void> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    noWorkspaceMessage();
    return;
  }

  const text = await vscode.window.showInputBox({
    prompt: 'Quick note to append to the encrypted project note',
    placeHolder: 'e.g. Rotated the staging API token',
    ignoreFocusOut: true,
  });

  if (text === undefined) {
    return; // user cancelled
  }
  if (text.trim().length === 0) {
    void vscode.window.showWarningMessage('pwdnote: nothing to add — note text was empty.');
    return;
  }

  try {
    logInfo(`Running: pwdnote add (text length ${text.length}, content not logged)`);
    const result = await runPwdnote(['add', text], cwd);
    if (result.code === 0) {
      void vscode.window.showInformationMessage('pwdnote: note added.');
    } else {
      logError(`add exited with code ${result.code}: ${result.stderr.trim()}`);
      void vscode.window
        .showErrorMessage('pwdnote: add failed. See output for details.', 'Show Output')
        .then((c) => c === 'Show Output' && showLog());
    }
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      await showCliRequired();
      return;
    }
    logError(`add threw: ${(err as Error).message}`);
    void vscode.window.showErrorMessage('pwdnote: add failed unexpectedly. See output.');
  }
}
