import * as vscode from 'vscode';
import {
  getCliVersion,
  getWorkspaceCwd,
  meetsMinVersion,
  showCliVersionRequired,
} from './cli';
import { addQuickNote } from './commands/addQuickNote';
import { initNote } from './commands/initNote';
import { openNote } from './commands/openNote';
import { showStatus } from './commands/showStatus';
import { EncryptedNoteEditorProvider } from './encryptedNoteEditor';
import { initLog, logInfo } from './log';
import { NoteFileSystemProvider, PWDNOTE_SCHEME } from './noteFileSystemProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initLog(context);
  logInfo('pwdnote extension activated.');

  // Virtual filesystem backing the decrypted, editable note view. readFile ->
  // `pwdnote read`; writeFile -> `pwdnote write --stdin --create`.
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(PWDNOTE_SCHEME, new NoteFileSystemProvider(), {
      isCaseSensitive: true,
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('pwdnote.openNote', openNote),
    vscode.commands.registerCommand('pwdnote.initNote', initNote),
    vscode.commands.registerCommand('pwdnote.addQuickNote', addQuickNote),
    vscode.commands.registerCommand('pwdnote.showStatus', showStatus),
  );

  // Clicking a `*.pwdnote.enc` file opens the decrypted note via this editor.
  context.subscriptions.push(EncryptedNoteEditorProvider.register());

  // Non-blocking CLI version check on activation.
  void checkCliOnActivation();
}

async function checkCliOnActivation(): Promise<void> {
  const cwd = getWorkspaceCwd() ?? process.cwd();
  try {
    const version = await getCliVersion(cwd);
    if (!version || !meetsMinVersion(version)) {
      logInfo(`pwdnote CLI version ${version ? version.join('.') : 'unknown'} is unsupported.`);
      await showCliVersionRequired();
      return;
    }
    logInfo(`pwdnote CLI ${version.join('.')} detected.`);
  } catch {
    // Binary not found in PATH; prompt to install.
    await showCliVersionRequired();
  }
}

export function deactivate(): void {
  // Nothing to clean up beyond context.subscriptions disposables.
}
