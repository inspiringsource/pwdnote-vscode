# Development notes

## Architecture

The extension is a frontend for the `pwdnote` CLI. There is deliberately **no**
TypeScript encryption, **no** second note format, and **no** secret storage in
VS Code settings. Each command shells out to `pwdnote` with the workspace folder
as `cwd`.

```
src/
  extension.ts            Activation, command + custom-editor registration, CLI check
  cli.ts                  execFile wrapper, PATH/capability detection, cwd resolution
  log.ts                  The "pwdnote" output channel (errors/diagnostics only)
  commands/
    initNote.ts           pwdnote init
    addQuickNote.ts       pwdnote add "<text>"
    showStatus.ts         pwdnote status
    openNote.ts           pwdnote read  (capability-gated)
  encryptedNoteEditor.ts  Read-only custom editor groundwork for *.pwdnote.enc
  test/
    extension.test.ts     Smoke tests (commands + manifest)
```

## CLI capability detection

`getCliCommands()` parses `pwdnote --help` to learn which subcommands the
installed CLI advertises. Commands that depend on a missing subcommand degrade
to an explanatory message instead of failing or hacking around encryption.

## Status of CLI integration (as observed)

The currently installed CLI exposes:

```
init  edit  add  status  gitignore  config
```

Implemented against existing commands:

- [x] `pwdnote: Initialize Project Note` → `pwdnote init`
- [x] `pwdnote: Add Quick Note` → `pwdnote add "<text>"`
- [x] `pwdnote: Show Status` → `pwdnote status`

Blocked on missing CLI commands (implemented but capability-gated):

- [ ] `pwdnote: Open Project Note` needs **`pwdnote read`** — print the
      decrypted note to stdout, non-interactively, exit 0 on success.
- [ ] Editing / saving from VS Code needs **`pwdnote write --stdin`** (or
      equivalent) — read new note contents from stdin and re-encrypt in place,
      non-interactively.
- [ ] The `.pwdnote.enc` custom editor becomes a real decrypted view once
      `pwdnote read` exists; a writable custom editor additionally needs the
      stdin write path above.

### Requested CLI additions (for the pwdnote project)

```
pwdnote read              # write decrypted note to stdout; exit non-zero on error
pwdnote write --stdin     # replace note contents from stdin, then re-encrypt
```

Both must run without launching `$EDITOR` or prompting interactively so the
extension can drive them. Until they land, do **not** add a TypeScript
decrypt/encrypt path — that would fork the format and the security model.

## Manual smoke test

1. `npm install && npm run compile`
2. Press **F5** to open the Extension Development Host.
3. Open a folder with `pwdnote` on `PATH`.
4. Run **pwdnote: Show Status** — output appears in the *pwdnote* channel.
5. Run **pwdnote: Initialize Project Note**, then **Add Quick Note**.
6. Run **pwdnote: Open Project Note** — with today's CLI it reports that the CLI
   lacks VS Code integration (`read`).

## Notes / decisions

- `package.json` `categories` is `["Other"]`. VS Code does not define a
  "Productivity" category, so adding it would fail `vsce` packaging; the
  productivity intent is captured in `keywords` instead.
- Tests use `@vscode/test-cli` (`npm test`); they compile and run a headless VS
  Code instance, so they require a display/electron environment.
