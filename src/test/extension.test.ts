import * as assert from 'assert';
import * as vscode from 'vscode';
import { meetsMinVersion } from '../cli';

const EXPECTED_COMMANDS = [
  'pwdnote.openNote',
  'pwdnote.initNote',
  'pwdnote.addQuickNote',
  'pwdnote.showStatus',
];

suite('pwdnote extension', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('inspiringsource.pwdnote-vscode');
    assert.ok(ext, 'extension not found by id');
    await ext.activate();
  });

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

  test('meetsMinVersion enforces the 0.3.0 floor', () => {
    assert.strictEqual(meetsMinVersion([0, 3, 0]), true, '0.3.0 should pass');
    assert.strictEqual(meetsMinVersion([0, 3, 1]), true, '0.3.1 should pass');
    assert.strictEqual(meetsMinVersion([1, 0, 0]), true, '1.0.0 should pass');
    assert.strictEqual(meetsMinVersion([0, 2, 9]), false, '0.2.9 should fail');
    assert.strictEqual(meetsMinVersion([0, 0, 1]), false, '0.0.1 should fail');
  });
});
