import * as path from 'path';
import * as vscode from 'vscode';
import { ensureCliReady } from './cli';
import { logError, logInfo } from './log';
import { noteVirtualUri } from './noteFileSystemProvider';

/**
 * Custom editor for `*.pwdnote.enc` files.
 *
 * UX goal: clicking a `.pwdnote.enc` file shows the decrypted note (editable),
 * not the ciphertext. This provider implements that by redirecting: when VS Code
 * opens the encrypted file with this editor, we open the editable decrypted
 * virtual document (backed by the pwdnote CLI) in the same editor group and then
 * dispose this placeholder panel.
 *
 * The provider never decrypts the `.pwdnote.enc` bytes itself — all decryption
 * and encryption is delegated to the CLI through the virtual filesystem
 * provider. If the CLI is missing or too old, it shows an explanatory page
 * instead of redirecting.
 */
export class EncryptedNoteEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'pwdnote.encryptedNote';

  public static register(): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      EncryptedNoteEditorProvider.viewType,
      new EncryptedNoteEditorProvider(),
      {
        webviewOptions: { retainContextWhenHidden: false },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  public openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => undefined };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: false };
    webviewPanel.webview.html = this.messageHtml('Decrypting…', 'Opening the decrypted note.');

    const cwd = path.dirname(document.uri.fsPath);

    if (!(await ensureCliReady(cwd))) {
      webviewPanel.webview.html = this.placeholderHtml(document.uri);
      return;
    }

    try {
      const uri = await noteVirtualUri(cwd);
      const doc = await vscode.workspace.openTextDocument(uri);
      if (doc.languageId !== 'markdown') {
        await vscode.languages.setTextDocumentLanguage(doc, 'markdown');
      }
      logInfo('encryptedNoteEditor: redirecting to decrypted note view.');
      await vscode.window.showTextDocument(doc, {
        viewColumn: webviewPanel.viewColumn,
        preview: false,
      });
      // Replace this placeholder tab with the decrypted, editable document.
      webviewPanel.dispose();
    } catch (err) {
      logError(`encryptedNoteEditor: failed to open decrypted note: ${(err as Error).message}`);
      webviewPanel.webview.html = this.messageHtml(
        'Could not open note',
        'Opening the decrypted note failed. See the pwdnote output channel.',
      );
    }
  }

  private placeholderHtml(uri: vscode.Uri): string {
    const file = escapeHtml(uri.path.split('/').pop() ?? '.pwdnote.enc');
    return this.wrap(`
      <h1>pwdNote encrypted note</h1>
      <p><code>${file}</code> is an encrypted pwdnote file.</p>
      <p>To view it here, install or update the pwdnote CLI to 0.3.0 or newer:</p>
      <pre>uv tool install pwdnote
uv tool upgrade pwdnote</pre>
      <p>The extension never decrypts the file itself — decryption is always
      delegated to the CLI.</p>
    `);
  }

  private messageHtml(title: string, body: string): string {
    return this.wrap(`<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>`);
  }

  private wrap(body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline';" />
  <style>
    body { font-family: var(--vscode-font-family); padding: 1rem 1.5rem;
           color: var(--vscode-foreground); }
    code, pre { font-family: var(--vscode-editor-font-family, monospace); }
    pre { white-space: pre-wrap; word-break: break-word;
          background: var(--vscode-textCodeBlock-background); padding: 1rem;
          border-radius: 4px; }
  </style>
</head>
<body>${body}</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
