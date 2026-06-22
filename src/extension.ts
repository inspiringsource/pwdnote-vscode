import * as vscode from 'vscode';
import { getWorkspaceCwd, isCliAvailable, showCliRequired } from './cli';
import { addQuickNote } from './commands/addQuickNote';
import { initNote } from './commands/initNote';
import { openNote } from './commands/openNote';
import { showStatus } from './commands/showStatus';
import { EncryptedNoteEditorProvider } from './encryptedNoteEditor';
import { initLog, logInfo } from './log';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initLog(context);
  logInfo('pwdnote extension activated.');

  context.subscriptions.push(
    vscode.commands.registerCommand('pwdnote.openNote', openNote),
    vscode.commands.registerCommand('pwdnote.initNote', initNote),
    vscode.commands.registerCommand('pwdnote.addQuickNote', addQuickNote),
    vscode.commands.registerCommand('pwdnote.showStatus', showStatus),
  );

  // Custom editor groundwork for `*.pwdnote.enc`. Read-only placeholder today;
  // see EncryptedNoteEditorProvider for the upgrade path.
  context.subscriptions.push(EncryptedNoteEditorProvider.register());

  // One-time, non-blocking CLI presence check on activation.
  void checkCliOnActivation();
}

async function checkCliOnActivation(): Promise<void> {
  // Probe from a workspace folder if there is one, otherwise the home/default
  // cwd is fine just to confirm the binary resolves in PATH.
  const cwd = getWorkspaceCwd() ?? process.cwd();
  const available = await isCliAvailable(cwd);
  if (!available) {
    await showCliRequired();
  } else {
    logInfo('pwdnote CLI detected in PATH.');
  }
}

export function deactivate(): void {
  // Nothing to clean up beyond context.subscriptions disposables.
}
