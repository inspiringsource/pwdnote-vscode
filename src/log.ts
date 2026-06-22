import * as vscode from 'vscode';

/**
 * Single shared output channel named "pwdnote".
 *
 * Security: this channel is used for diagnostics and command-execution errors
 * ONLY. It must never receive decrypted note content, plaintext the user typed
 * into a quick note, or any key material. Callers are responsible for passing
 * sanitized strings.
 */
let channel: vscode.OutputChannel | undefined;

export function initLog(context: vscode.ExtensionContext): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('pwdnote');
    context.subscriptions.push(channel);
  }
  return channel;
}

function ts(): string {
  return new Date().toISOString();
}

export function logInfo(message: string): void {
  channel?.appendLine(`[${ts()}] ${message}`);
}

export function logError(message: string): void {
  channel?.appendLine(`[${ts()}] ERROR ${message}`);
}

/** Reveal the output channel to the user without stealing focus from the editor. */
export function showLog(): void {
  channel?.show(true);
}
