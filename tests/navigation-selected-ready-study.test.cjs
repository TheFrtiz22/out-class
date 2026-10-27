const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { outputDirectory } = require('../scripts/navigation-selected-ready-study.cjs');

test('selected-startup comparison accepts only declared profiles and preserves existing evidence', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-selected-output-test-'));
  try {
    const file = outputDirectory('local', repo);
    assert.equal(file, path.join(repo, 'docs/performance/selected-ready-20261027/local'));
    for (const value of ['', '../phase15', 'local/other', 'constructor', undefined]) assert.throws(() => outputDirectory(value, repo));
    fs.mkdirSync(file, { recursive: true }); fs.writeFileSync(path.join(file, 'PROTOCOL.json'), 'existing evidence');
    assert.throws(() => outputDirectory('local', repo));
    assert.equal(fs.readFileSync(path.join(file, 'PROTOCOL.json'), 'utf8'), 'existing evidence');
    assert.equal(outputDirectory('constrained', repo), path.join(path.dirname(file), 'constrained'));
  } finally { fs.rmSync(repo, { recursive: true }); }
});
