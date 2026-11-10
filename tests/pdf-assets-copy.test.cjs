const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { copyAssets } = require('../scripts/copy-pdfjs-assets.cjs');

test('PDF assets retain unchanged files and repair missing, corrupt and upgraded files', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-pdf-assets-'));
  const source = path.join(temporary, 'source'), output = path.join(temporary, 'output');
  const assets = ['cmaps/map.bcmap', 'standard_fonts/font.pfb', 'wasm/decoder.wasm', 'iccs/profile.icc', 'build/pdf.worker.min.mjs', 'LICENSE'];
  try {
    for (const asset of assets) {
      fs.mkdirSync(path.dirname(path.join(source, asset)), { recursive: true });
      fs.writeFileSync(path.join(source, asset), asset);
    }
    fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    copyAssets(source, output);
    const targets = assets.map(asset => asset.replace('build/', '')).concat('version.json');
    const stamp = new Date('2000-01-01T00:00:00Z');
    for (const asset of targets) fs.utimesSync(path.join(output, asset), stamp, stamp);
    copyAssets(source, output);
    for (const asset of targets) assert.equal(fs.statSync(path.join(output, asset)).mtimeMs, +stamp);
    fs.unlinkSync(path.join(output, 'wasm/decoder.wasm'));
    fs.writeFileSync(path.join(output, 'cmaps/map.bcmap'), 'corrupt');
    fs.writeFileSync(path.join(source, 'build/pdf.worker.min.mjs'), 'upgraded worker');
    fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ version: '2.0.0' }));
    copyAssets(source, output);
    for (const asset of assets) assert.deepEqual(fs.readFileSync(path.join(output, asset.replace('build/', ''))), fs.readFileSync(path.join(source, asset)));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'version.json'))), { version: '2.0.0' });
    assert.equal(fs.statSync(path.join(output, 'LICENSE')).mtimeMs, +stamp);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
