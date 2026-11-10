// The CI hydration capture saves the server HTML and the recovered DOM when React reports a mismatch.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), os = require('node:os'), path = require('node:path');
const { chromium } = require('playwright');
const { bundle } = require('./helpers/browser-bundle.cjs');

test('hydration capture writes server HTML, client DOM and metadata on React #418', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-hydration-capture-'));
  process.env.OUTCLASS_HYDRATION_CAPTURE_DIR = directory;
  delete require.cache[require.resolve('./helpers/hydration-capture.cjs')];
  const { captureHydration } = require('./helpers/hydration-capture.cjs');
  const js = bundle(`import React from'react';import{hydrateRoot}from'react-dom/client';
hydrateRoot(document.getElementById('root'),<main><a href="/apply">Apply</a></main>,{onRecoverableError(error){setTimeout(()=>{throw error})}});`);
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/app.js' ? js : '<!doctype html><div id="root"><main><p data-server="closing">Closing soon</p></main></div><script src="/app.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    captureHydration(page, 'synthetic mismatch');
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('a[href="/apply"]').waitFor();
    for (let i = 0; i < 100 && fs.readdirSync(directory).length < 3; i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(errors.some(message => /418|[Hh]ydrat/.test(message)), 'React reported the mismatch');
    const files = fs.readdirSync(directory).sort();
    assert.equal(files.length, 3, files.join(', '));
    const read = suffix => fs.readFileSync(path.join(directory, files.find(file => file.endsWith(suffix))), 'utf8');
    assert.match(read('-server.html'), /data-server="closing"/, 'server HTML is the original response');
    assert.match(read('-client.html'), /href="\/apply"/, 'client HTML is the DOM after recovery');
    const meta = JSON.parse(read('-meta.json'));
    assert.match(meta.error, /418|[Hh]ydrat/); assert.match(meta.document, /^http:\/\/127\.0\.0\.1:/);
  } finally { await browser.close(); server.close(); delete process.env.OUTCLASS_HYDRATION_CAPTURE_DIR; }
});
