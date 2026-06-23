# Changelog

All notable changes to the **pwdNote for VS Code** extension are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] — UX polish

### Added
- **📝 pwdnote status bar item** — visible when a workspace folder is open;
  clicking it runs **pwdnote: Open Project Note**.
- README **Screenshots** and **Demo (GIF)** placeholder sections, plus an
  up-front note that the pwdnote CLI is required.
- `CHANGELOG.md` and `onStartupFinished` activation so the status bar appears
  without first running a command.

### Changed
- The decrypted note now opens in a tab titled **Project Notes** (was `note.md`).
- Markdown language mode is applied before the editor is revealed, so syntax
  highlighting is active immediately with no plaintext flash.

No changes to encryption, the note format, or the CLI version requirement
(pwdnote >= 0.3.0).

## [0.1.0] — CLI 0.3.0 integration

### Added
- **Open Project Note** opens the decrypted note in an editable, in-memory
  document backed by a virtual `pwdnote:` filesystem (`pwdnote read`).
- **Save** re-encrypts via `pwdnote write --stdin --create` with a transient
  "Saved" confirmation; no plaintext is written to disk.
- Custom editor that redirects `*.pwdnote.enc` to the decrypted view.
- CLI version gate requiring pwdnote >= 0.3.0 with install/upgrade hints.

## [0.0.1] — Initial scaffold

### Added
- VS Code extension scaffold and the `pwdnote` output channel.
- Commands: Initialize Project Note, Add Quick Note, Show Status; CLI detection.
