import * as vscode from 'vscode';
import {
  CliNotFoundError,
  ensureCliReady,
  getWorkspaceCwd,
  noWorkspaceMessage,
  showCliVersionRequired,
} from '../cli';
import { logError, showLog } from '../log';
import { noteVirtualUri } from '../noteFileSystemProvider';

/**
 * `pwdnote: Open Project Note`.
 *
 * Opens the decrypted note in an editable, in-memory document backed by the
 * pwdnote virtual filesystem. Reading is delegated to `pwdnote read` and saving
 * to `pwdnote write --stdin --create`; the extension never decrypts or writes
 * plaintext to disk itself.
 */
export async function openNote(): Promise<void> {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    noWorkspaceMessage();
    return;
  }

  if (!(await ensureCliReady(cwd))) {
    return;
  }

  try {
    const uri = await noteVirtualUri(cwd);
    const doc = await vscode.workspace.openTextDocument(uri);
    if (doc.languageId !== 'markdown') {
      await vscode.languages.setTextDocumentLanguage(doc, 'markdown');
    }
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      await showCliVersionRequired();
      return;
    }
    logError(`openNote threw: ${(err as Error).message}`);
    void vscode.window
      .showErrorMessage('pwdnote: opening the note failed. See output.', 'Show Output')
      .then((c) => c === 'Show Output' && showLog());
  }
}
