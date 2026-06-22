# pwdNote for VS Code

VS Code integration for [pwdnote](https://github.com/inspiringsource/pwdnote) —
encrypted, project-local notes for your terminal.

This extension is a **thin frontend** for the `pwdnote` command-line tool. It
does not implement encryption, define its own note format, or store secrets in
VS Code settings. All cryptography, key management, and the on-disk
`.pwdnote.enc` file are owned by the CLI. The extension simply runs the CLI from
your workspace folder and surfaces the results.

## Requirements

This extension **requires the pwdnote CLI** to be installed and available on your
`PATH`.

```sh
uv tool install pwdnote
```

On activation the extension checks for `pwdnote` in `PATH`. If it is missing you
will see:

> pwdnote CLI is required.

…along with the install command above (with a one-click "copy" action). The
extension does **not** attempt to install the CLI automatically.

## Features

Available from the Command Palette (all prefixed with **pwdnote:**):

| Command | What it does | CLI used |
| --- | --- | --- |
| **pwdnote: Initialize Project Note** | Create the encrypted project note in the current workspace. | `pwdnote init` |
| **pwdnote: Add Quick Note** | Prompt for a line of text and append it to the note. | `pwdnote add "<text>"` |
| **pwdnote: Show Status** | Show the project root, note file, and encryption status in the **pwdnote** output channel. | `pwdnote status` |
| **pwdnote: Open Project Note** | Open the decrypted note in an in-memory editor. | `pwdnote read` *(see limitations)* |

All commands run with the workspace folder as the working directory (the folder
of the active editor, falling back to the first workspace folder), because
pwdnote notes are project-local.

There is also groundwork for a **custom editor** so that, in the future, opening
a `.pwdnote.enc` file shows the decrypted note instead of ciphertext. Today this
editor is a read-only placeholder (see limitations).

## Current limitations

These depend on CLI features that the installed pwdnote version does not expose
yet:

- **Open Project Note** needs a non-interactive `pwdnote read` that prints the
  decrypted note to stdout. If the installed CLI does not advertise `read`, the
  command explains that *"the installed pwdnote CLI version does not support VS
  Code integration yet"* rather than working around encryption.
- **Editing from VS Code** needs a non-interactive write path
  (e.g. `pwdnote write --stdin`). Until then, edit with `pwdnote edit` in a
  terminal.
- The `.pwdnote.enc` **custom editor** is read-only groundwork. It shows the
  decrypted note only when `pwdnote read` exists; otherwise it shows a
  placeholder. It never decrypts the file itself.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the exact CLI commands the extension
needs next.

## Security model

- The extension **never** reimplements encryption — the CLI is the only engine.
- The extension **never** stores secrets in VS Code settings.
- Decrypted content is shown only in **untitled / in-memory** documents and
  webviews; it is never written to disk by the extension.
- The **pwdnote** output channel logs command execution and errors only — never
  decrypted note content, never the text of a quick note, never key material.
- Key management stays entirely with the local pwdnote CLI.

## Installing locally during development

```sh
git clone https://github.com/inspiringsource/pwdnote-vscode
cd pwdnote-vscode
npm install
npm run compile
```

Then press **F5** in VS Code ("Run Extension") to launch an Extension
Development Host with the extension loaded. Open a folder, ensure `pwdnote` is on
your `PATH`, and try the **pwdnote:** commands from the Command Palette.

To watch and rebuild on change: `npm run watch`.

## Links

- Source: <https://github.com/inspiringsource/pwdnote>
- PyPI: <https://pypi.org/project/pwdnote/>
- Docs: <https://inspiringsource.github.io/pwdnote/>

## License

MIT
