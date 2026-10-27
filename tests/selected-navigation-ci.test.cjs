const { test } = require('node:test'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

test('selected navigation CI rejects another fixture mode before touching the owned directory or services', () => {
  const root = path.join(os.tmpdir(), 'outclass-onboarding-e2e');
  const before = fs.existsSync(root) ? fs.statSync(root).mtimeMs : null;
  for (const args of [['--selected-navigation'], ['--club-integration', '--selected-navigation', '--dashboards'], ['--club-integration', '--selected-navigation', '--application-writing']]) {
    const result = spawnSync(process.execPath, ['scripts/run-onboarding-e2e.cjs', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--selected-navigation requires --club-integration on the onboarding fixture/);
    assert.equal(fs.existsSync(root) ? fs.statSync(root).mtimeMs : null, before);
  }
});
