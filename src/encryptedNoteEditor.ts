import * as vscode from 'vscode';
import { getCliCommands, runPwdnote } from './cli';
import { logError, logInfo } from './log';

/**
 * Groundwork custom editor for `*.pwdnote.enc` files.
 *
 * Long-term goal: clicking a `.pwdnote.enc` file opens the decrypted note view
 * instead of raw ciphertext. That requires the CLI to expose a non-interactive
 * decrypt (`pwdnote read`) and, for editing, a write-from-stdin path
 * (`pwdnote write --stdin`). Until those exist, this provider is intentionally
 * read-only and shows an explanatory placeholder — it never attempts to decrypt
 * the bytes itself.
 *
 * Registered as a CustomReadonlyEditorProvider so the registration plumbing,
 * view type, and file association are all in place for the future
 * implementation without committing to complex editing behavior now.
 */
export class EncryptedNoteEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'pwdnote.encryptedNote';

  public static register(): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      EncryptedNoteEditorProvider.viewType,
      new EncryptedNoteEditorProvider(),
      {
        // Keep the (cheap, placeholder) webview around so reopening is instant.
        webviewOptions: { retainContextWhenHidden: false },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  // A custom document need carry no state for this read-only placeholder.
  public openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => undefined };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: false };

    const cwd = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
      ?? vscode.Uri.joinPath(document.uri, '..').fsPath;

    let canRead = false;
    try {
      const commands = await getCliCommands(cwd);
      canRead = commands.has('read');
    } catch (err) {
      logError(`encryptedNoteEditor: capability probe failed: ${(err as Error).message}`);
    }

    if (!canRead) {
      webviewPanel.webview.html = this.placeholderHtml(document.uri);
      return;
    }

    // The CLI can decrypt to stdout. Show the decrypted note read-only.
    // Security: decrypted content is rendered in the webview only and never
    // logged or written to disk by the extension.
    try {
      logInfo('encryptedNoteEditor: rendering decrypted note via `pwdnote read`');
      const result = await runPwdnote(['read'], cwd);
      if (result.code === 0) {
        webviewPanel.webview.html = this.notePreviewHtml(result.stdout);
      } else {
        logError(`encryptedNoteEditor: read exited ${result.code}`);
        webviewPanel.webview.html = this.placeholderHtml(document.uri);
      }
    } catch (err) {
      logError(`encryptedNoteEditor: read threw: ${(err as Error).message}`);
      webviewPanel.webview.html = this.placeholderHtml(document.uri);
    }
  }

  private placeholderHtml(uri: vscode.Uri): string {
    const file = escapeHtml(uri.path.split('/').pop() ?? '.pwdnote.enc');
    return this.wrap(`
      <h1>pwdNote encrypted note</h1>
      <p><code>${file}</code> is an encrypted pwdnote file.</p>
      <p>This view will show the decrypted note once the installed pwdnote CLI
      supports a non-interactive <code>read</code> command. The extension never
      decrypts the file itself — decryption is always delegated to the CLI.</p>
      <p>For now, use <code>pwdnote edit</code> in a terminal, or the
      <em>pwdnote: Show Status</em> command.</p>
    `);
  }

  private notePreviewHtml(content: string): string {
    return this.wrap(`
      <h1>pwdNote</h1>
      <p class="muted">Decrypted, read-only preview. Edit with the pwdnote CLI.</p>
      <pre>${escapeHtml(content)}</pre>
    `);
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
    .muted { opacity: 0.7; }
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
