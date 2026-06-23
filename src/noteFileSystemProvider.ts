import * as path from 'path';
import * as vscode from 'vscode';
import { runPwdnote } from './cli';
import { logError, logInfo } from './log';

/**
 * Virtual filesystem scheme backing the decrypted note view.
 *
 * A document opened under this scheme behaves like a normal editable text file:
 * VS Code reads its content through {@link NoteFileSystemProvider.readFile} and
 * persists edits through {@link NoteFileSystemProvider.writeFile}. Both delegate
 * to the pwdnote CLI:
 *   - readFile  -> `pwdnote read`                  (decrypt to stdout)
 *   - writeFile -> `pwdnote write --stdin --create` (re-encrypt from stdin)
 *
 * The plaintext therefore lives only in VS Code's in-memory text model and is
 * streamed to the CLI over stdin. The extension never writes plaintext to disk,
 * never touches the `.pwdnote.enc` bytes itself, and never logs note content.
 */
export const PWDNOTE_SCHEME = 'pwdnote';

/**
 * Basename used for the virtual note document. It becomes the editor tab title,
 * so it is human-friendly ("Project Notes") rather than a filename. The Markdown
 * language mode is applied explicitly in {@link showNoteDocument}, so no file
 * extension is needed.
 */
const NOTE_LABEL = 'Project Notes';

/**
 * Build the stable virtual URI for the note in a given workspace directory. The
 * URI is anchored at the real project root (via `pwdnote root`) so the same note
 * maps to one URI. The CLI working directory is recovered from the URI in
 * {@link cwdForUri}.
 */
export async function noteVirtualUri(cwd: string): Promise<vscode.Uri> {
  const result = await runPwdnote(['root'], cwd);
  const root = result.code === 0 && result.stdout.trim().length > 0
    ? result.stdout.trim()
    : cwd;
  return vscode.Uri.file(path.join(root, NOTE_LABEL)).with({ scheme: PWDNOTE_SCHEME });
}

function cwdForUri(uri: vscode.Uri): string {
  return path.dirname(uri.fsPath);
}

/**
 * Open (or focus) the decrypted note for a workspace directory, force the
 * Markdown language mode, and reveal it. Shared by the Open Project Note command
 * and the `.pwdnote.enc` custom editor so both behave identically.
 */
export async function showNoteDocument(
  cwd: string,
  viewColumn?: vscode.ViewColumn,
): Promise<void> {
  const uri = await noteVirtualUri(cwd);
  let doc = await vscode.workspace.openTextDocument(uri);
  if (doc.languageId !== 'markdown') {
    // setTextDocumentLanguage may return a fresh document instance for the URI;
    // use the returned one so syntax highlighting is active before we reveal it.
    doc = await vscode.languages.setTextDocumentLanguage(doc, 'markdown');
  }
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn });
}

export class NoteFileSystemProvider implements vscode.FileSystemProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  public readonly onDidChangeFile = this.emitter.event;

  // No real file to watch; edits are tracked by VS Code's text model.
  public watch(): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  // We intentionally do not decrypt just to report a size. A constant stat is
  // sufficient for VS Code to treat the URI as an existing, editable file; the
  // authoritative content always comes from readFile.
  public stat(): vscode.FileStat {
    return { type: vscode.FileType.File, ctime: Date.now(), mtime: Date.now(), size: 0 };
  }

  public readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  public createDirectory(): void {
    // no-op: this provider exposes a single virtual note file.
  }

  public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const cwd = cwdForUri(uri);
    const result = await runPwdnote(['read'], cwd);
    if (result.code === 0) {
      return Buffer.from(result.stdout, 'utf8');
    }
    // Exit non-zero here means "no project note yet" (or a read error). Present
    // an empty buffer so the user can type and create it on first save.
    logInfo('noteFS: no existing note to read; opening an empty buffer.');
    return new Uint8Array();
  }

  public async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    const cwd = cwdForUri(uri);
    const text = Buffer.from(content).toString('utf8');
    // `--create` makes this idempotent: it creates the note when missing and
    // replaces it when present, so we never need to stat the encrypted file.
    const result = await runPwdnote(['write', '--stdin', '--create'], cwd, text);
    if (result.code !== 0) {
      logError(`noteFS: write failed (exit ${result.code}): ${result.stderr.trim()}`);
      throw vscode.FileSystemError.NoPermissions(
        'pwdnote: failed to encrypt and save the note. See the pwdnote output channel.',
      );
    }
    vscode.window.setStatusBarMessage('pwdnote: Saved', 2000);
    this.emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public delete(): void {
    throw vscode.FileSystemError.NoPermissions('pwdnote: deleting the note here is not supported.');
  }

  public rename(): void {
    throw vscode.FileSystemError.NoPermissions('pwdnote: renaming the note here is not supported.');
  }
}
