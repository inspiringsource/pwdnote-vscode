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
 * Build the stable virtual URI for the note in a given workspace directory. The
 * URI is anchored at the real project root (via `pwdnote root`) and ends in
 * `note.md` so VS Code selects the Markdown language mode. The CLI working
 * directory is recovered from the URI in {@link cwdForUri}.
 */
export async function noteVirtualUri(cwd: string): Promise<vscode.Uri> {
  const result = await runPwdnote(['root'], cwd);
  const root = result.code === 0 && result.stdout.trim().length > 0
    ? result.stdout.trim()
    : cwd;
  return vscode.Uri.file(path.join(root, 'note.md')).with({ scheme: PWDNOTE_SCHEME });
}

function cwdForUri(uri: vscode.Uri): string {
  return path.dirname(uri.fsPath);
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
