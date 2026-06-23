# Development notes

## Architecture

The extension is a frontend for the `pwdnote` CLI. There is deliberately **no**
TypeScript encryption, **no** second note format, and **no** secret storage in
VS Code settings. Each command shells out to `pwdnote` with the workspace folder
as `cwd`.

```
src/
  extension.ts                Activation, command + provider registration, version check
  cli.ts                      execFile/stdin wrapper, version detection + gating, cwd resolution
  log.ts                      The "pwdnote" output channel (errors/diagnostics only)
  noteFileSystemProvider.ts   Virtual `pwdnote:` FS bridging the editor to read/write
  encryptedNoteEditor.ts      Custom editor for *.pwdnote.enc (redirects to decrypted view)
  commands/
    initNote.ts               pwdnote init
    addQuickNote.ts           pwdnote add "<text>"
    showStatus.ts             pwdnote status
    openNote.ts               opens the decrypted virtual document
  test/
    extension.test.ts         Smoke tests (commands + manifest + version gate)
```

## Read / edit / save via a virtual filesystem

The decrypted note is exposed through a `FileSystemProvider` registered for the
`pwdnote:` scheme (`noteFileSystemProvider.ts`). A document opened under this
scheme behaves like a normal editable text file:

- `readFile`  → `pwdnote read` (decrypt to stdout). A non-zero exit (no note
  yet) yields an empty buffer the user can populate.
- `writeFile` → `pwdnote write --stdin --create` (re-encrypt from stdin). The
  `--create` flag is idempotent — it creates the note when missing and replaces
  it when present — so the provider never has to stat or touch the `.pwdnote.enc`
  bytes. On success it flashes a transient **"Saved"** status-bar message.

The plaintext therefore exists only in VS Code's in-memory text model and is
streamed to the CLI over stdin. Nothing plaintext is written to disk.

The virtual URI is anchored at the real project root (`pwdnote root`) and ends in
`note.md` so VS Code selects Markdown. The CLI working directory is recovered as
the URI's parent directory.

`encryptedNoteEditor.ts` registers a custom editor for `*.pwdnote.enc`. When such
a file is opened it redirects to the decrypted virtual document in the same
editor group and disposes its placeholder panel — so clicking the encrypted file
shows the editable decrypted note. If the CLI is missing/too old it shows an
explanatory page instead.

## Version gating

`getCliVersion()` parses `pwdnote --version`; `meetsMinVersion()` enforces the
0.3.0 floor. `ensureCliReady()` runs before every read/edit/save flow (and on
activation) and shows the *"pwdnote CLI 0.3.0 or newer is required."* message,
with copy actions for `uv tool install pwdnote` and `uv tool upgrade pwdnote`,
when the requirement is not met.

## CLI integration status

Built against pwdnote **0.3.0** (`init`, `edit`, `add`, `status`, `gitignore`,
`read`, `write`, `root`, `note-path`, `config`):

- [x] `pwdnote: Open Project Note` → `pwdnote read` + `pwdnote write --stdin --create`
- [x] Click `.pwdnote.enc` → decrypted, editable view
- [x] `pwdnote: Initialize Project Note` → `pwdnote init`
- [x] `pwdnote: Add Quick Note` → `pwdnote add "<text>"`
- [x] `pwdnote: Show Status` → `pwdnote status`

## Manual smoke test

1. `npm install && npm run compile`
2. Press **F5** to open the Extension Development Host.
3. Open a folder with `pwdnote` (>= 0.3.0) on `PATH`.
4. Run **pwdnote: Open Project Note** — type some text and **save**; a "Saved"
   message appears and `.pwdnote.enc` is created/updated.
5. Close the tab, then click the `.pwdnote.enc` file — it reopens decrypted.
6. Run **pwdnote: Show Status**, **Add Quick Note**, **Initialize Project Note**.

## Marketplace preparation

Ready: `name`, `displayName`, `description`, `publisher`, `repository`,
`homepage`, `bugs`, `license` + `LICENSE`, `keywords`, `categories`, `README`,
`CHANGELOG`, **`icon`** (`images/icon.png`, 128×128 PNG, bundled in the `.vsix`).

Still missing before publishing (intentionally not done — do not publish yet):

- **Screenshots / demo GIF** — captured from the running extension. The README
  notes "Screenshots will be added before Marketplace publication" rather than
  linking to images that do not exist yet. Add them (and link them) before
  publishing so the Marketplace page renders them.

## Notes / decisions

- The decrypted note's virtual URI uses the basename **"Project Notes"** (no
  extension) so the editor tab reads "Project Notes"; Markdown mode is applied
  explicitly in `showNoteDocument()` before the document is revealed.
- The status bar item activates via `onStartupFinished` so it can appear before
  any command is run, while keeping activation lightweight.
- `package.json` `categories` is `["Other"]`. VS Code does not define a
  "Productivity" category, so adding it would fail `vsce` packaging; the
  productivity intent is captured in `keywords` instead.
- Tests use `@vscode/test-cli` (`npm test`); they compile and run a headless VS
  Code instance, so they require a display/electron environment.
