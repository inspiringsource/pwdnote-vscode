import * as vscode from 'vscode';
import {
  CliNotFoundError,
  getCliCommands,
  getWorkspaceCwd,
  noWorkspaceMessage,
  runPwdnote,
  showCliRequired,
} from '../cli';
import { logError, logInfo, showLog } from '../log';

/**
 * Name of the CLI subcommand this view depends on. The installed CLI must be
 * able to print the decrypted note to stdout for the extension to display it
 * without reimplementing encryption.
 */
const READ_COMMAND = 'read';

const UPGRADE_MESSAGE =
  'The installed pwdnote CLI version does not support VS Code integration yet ' +
  '(missing `pwdnote read`). Update the CLI once a release adds it, or use ' +
  '`pwdnote edit` in a terminal for now.';

/**
 * `pwdnote: Open Project Note`.
 *
 * Displays the decrypted note in an untitled (in-memory, never persisted)
 * editor. Decryption is delegated entirely to the CLI via `pwdnote read`; the
 * extension does not decrypt anything itself. If the installed CLI lacks the
 * `read` command, we explain that rather than working around encryption.
 *
 * Security: the decrypted content is placed in an untitled document and is
 * never logged to the output channel nor written to disk by the extension.
 */
export async function openNote(): Promise<void> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    noWorkspaceMessage();
    return;
  }

  try {
    const commands = await getCliCommands(cwd);
    if (!commands.has(READ_COMMAND)) {
      logInfo(`openNote: CLI does not advertise a "${READ_COMMAND}" command; cannot display note.`);
      void vscode.window.showWarningMessage(UPGRADE_MESSAGE);
      return;
    }

    logInfo('Running: pwdnote read');
    const result = await runPwdnote([READ_COMMAND], cwd);
    if (result.code !== 0) {
      logError(`read exited with code ${result.code}: ${result.stderr.trim()}`);
      void vscode.window
        .showErrorMessage('pwdnote: could not open the project note. See output.', 'Show Output')
        .then((c) => c === 'Show Output' && showLog());
      return;
    }

    // Untitled document => held in memory, not associated with a file on disk.
    const doc = await vscode.workspace.openTextDocument({
      content: result.stdout,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc, { preview: false });
    void vscode.window.showInformationMessage(
      'pwdnote: opened a decrypted, in-memory copy. Use the CLI to save changes.',
    );
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      await showCliRequired();
      return;
    }
    logError(`openNote threw: ${(err as Error).message}`);
    void vscode.window.showErrorMessage('pwdnote: opening the note failed unexpectedly. See output.');
  }
}
