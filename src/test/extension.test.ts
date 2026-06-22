import * as assert from 'assert';
import * as vscode from 'vscode';

const EXPECTED_COMMANDS = [
  'pwdnote.openNote',
  'pwdnote.initNote',
  'pwdnote.addQuickNote',
  'pwdnote.showStatus',
];

suite('pwdnote extension', () => {
  test('registers all contributed commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of EXPECTED_COMMANDS) {
      assert.ok(commands.includes(id), `command not registered: ${id}`);
    }
  });

  test('extension manifest declares the encrypted-note custom editor', () => {
    const ext = vscode.extensions.getExtension('inspiringsource.pwdnote-vscode');
    assert.ok(ext, 'extension not found by id');
    const editors = ext.packageJSON.contributes?.customEditors ?? [];
    const viewTypes = editors.map((e: { viewType: string }) => e.viewType);
    assert.ok(
      viewTypes.includes('pwdnote.encryptedNote'),
      'custom editor viewType not declared',
    );
  });
});
