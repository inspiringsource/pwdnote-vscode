# Release checklist

Steps to cut a public **preview** release of **pwdNote for VS Code**. Work top to
bottom; do not skip the verification section.

## 1. Pre-flight

- [ ] Working tree is clean (`git status`) and on the intended branch.
- [ ] `package.json` `version` is correct and matches the top entry in
      `CHANGELOG.md`.
- [ ] `CHANGELOG.md` has a dated entry describing this release.
- [ ] No test artifacts are tracked (`.pwdnote.enc`, `*.vsix`, `.vscode-test/`,
      `.claude/` are all git-ignored).
- [ ] No secrets, keys, or decrypted note content anywhere in the tree.

## 2. Build & quality gates

```sh
npm install
npm run compile   # tsc, must be clean
npm run lint      # eslint, must be clean
npm test          # headless VS Code tests, must pass
```

- [ ] `compile` clean
- [ ] `lint` clean
- [ ] `test` green

## 3. Package the extension

```sh
npx vsce package
```

- [ ] Packaging succeeds and produces `pwdnote-vscode-<version>.vsix`.
- [ ] Inspect the bundle and confirm it contains **only** what should ship:

  ```sh
  unzip -l pwdnote-vscode-<version>.vsix
  ```

  Must **not** contain: `.pwdnote.enc`, `.claude/`, `src/`, `*.map`, `*.vsix`,
  `.vscode-test/`, `out/test/`.
  Must contain: `package.json`, `readme.md`, `changelog.md`, `LICENSE.txt`,
  `out/*.js` (extension code only).

## 4. Install locally and smoke-test

```sh
code --install-extension pwdnote-vscode-<version>.vsix
```

In a fresh VS Code window opened on a folder with `pwdnote` (>= 0.3.0) on `PATH`:

- [ ] **Activation** — no error toast when the CLI is present and current; the
      `pwdnote CLI 0.3.0 or newer is required.` message *does* appear when the
      CLI is missing/old (test by renaming it off `PATH`).
- [ ] **Status bar** — the **📝 pwdnote** item is visible; its tooltip reads
      "Open Project Note"; clicking it opens the note.
- [ ] **Commands** (Command Palette, `pwdnote:` prefix) all present and run:
  - [ ] Open Project Note
  - [ ] Initialize Project Note
  - [ ] Add Quick Note
  - [ ] Show Status
- [ ] **Note editing** — Open Project Note shows the decrypted note in a
      **Project Notes** tab in Markdown mode; edit and **save** (Ctrl/Cmd+S);
      a "Saved" status message appears and `.pwdnote.enc` is updated.
- [ ] **Encrypted file** — clicking a `*.pwdnote.enc` file opens the decrypted,
      editable view rather than ciphertext.
- [ ] **No plaintext on disk** — confirm the extension created no temporary
      plaintext file during the edit/save cycle.

## 5. Marketplace assets (required before publishing, optional for preview)

- [ ] `icon` — 128×128 PNG referenced via `"icon"` in `package.json`.
- [ ] `images/screenshot-note.png` — decrypted "Project Notes" tab.
- [ ] `images/screenshot-statusbar.png` — the 📝 pwdnote status bar item.
- [ ] `images/demo.gif` — open → edit → save flow.
- [ ] README image links resolve in the packaged extension / Marketplace preview.

## 6. Publish (only when the above is green)

```sh
# one-time: create a publisher and a Personal Access Token (Azure DevOps)
npx vsce login inspiringsource

# publish (mark as pre-release while in preview)
npx vsce publish --pre-release
```

- [ ] `publisher` in `package.json` matches the Marketplace publisher.
- [ ] Published with `--pre-release` while this is a preview.
- [ ] Tag the release in git (`git tag v<version>`) and push the tag.
- [ ] Verify the Marketplace listing renders README, images, and metadata.

## 7. Post-publish

- [ ] Install the published extension from the Marketplace in a clean window and
      re-run the smoke test in section 4.
- [ ] Open the next `## [Unreleased]` section in `CHANGELOG.md`.
