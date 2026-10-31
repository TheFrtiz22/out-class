// Real Chromium QA of the collector, independent of application timings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const { installStage } = require('./pipeline-release-full-review.cjs');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];
  try {
    await page.setContent('<button id="trigger">Open</button><div class="oc-live-pipeline">' +
      Array.from({ length: 5000 }, (_, i) => '<div data-applicant-id="' + i + '">Applicant ' + i + '</div>').join('') +
      '<button>Review applicants</button></div><div role="dialog" data-slot="sheet-content"><button>Close</button><p>Ada Synthetic application evidence.</p><p id="review">Loading authorized review information…</p></div>');
    await page.evaluate(() => {
      window.rowGeometryReads = 0;
      for (const row of document.querySelectorAll('[data-applicant-id]')) {
        const original = row.getClientRects.bind(row);
        row.getClientRects = () => { window.rowGeometryReads++; return original(); };
      }
      document.getElementById('trigger').onclick = () => setTimeout(() => {
        // Change only characterData: no child or attribute mutation can rescue it.
        document.getElementById('review').firstChild.nodeValue = 'Authorized review ready';
      }, 50);
    });
    await page.evaluate(installStage, { kind: 'detail', text: 'Ada', count: 0 });
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await page.waitForFunction(() => window.__releaseStage.ready > 0, null, { timeout: 3000 });
    const detail = await page.evaluate(() => ({ ...window.__releaseStage.finish(), rowGeometryReads: window.rowGeometryReads }));
    assert.equal(detail.rowGeometryReads, 0, 'Detail observation must not scan the obscured directory');
    assert.ok(detail.ready - detail.start >= 50);
    results.push({ kind: 'textOnlyDetailWith5000Rows', ...detail });
    await page.evaluate(() => {
      document.querySelector('[data-slot="sheet-content"]').remove();
      document.getElementById('trigger').onclick = () => {
        for (let i = 0; i < 100; i++) document.body.setAttribute('data-progress', String(i));
      };
    });
    await page.evaluate(installStage, { kind: 'entry', text: '', count: 5000 });
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await page.waitForFunction(() => window.__releaseStage.ready > 0, null, { timeout: 3000 });
    const entry = await page.evaluate(() => ({ ...window.__releaseStage.finish(), rowGeometryReads: window.rowGeometryReads }));
    assert.equal(entry.rowGeometryReads, 10000, 'Coalesced mutation burst needs only the two readiness scans');
    results.push({ kind: 'directory5000MutationBurst', ...entry });
    const report = { at: new Date().toISOString(), browser: browser.version(),
      collectorSha256: createHash('sha256').update(fs.readFileSync('scripts/pipeline-release-full-review.cjs')).digest('hex'), results };
    const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6);
    if (out) { assert.ok(!fs.existsSync(out)); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
