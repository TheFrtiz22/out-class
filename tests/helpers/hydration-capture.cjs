// On a React hydration error (#418/#423/#425) in an e2e page, save the server HTML of that page's last
// document response next to the DOM after React's recovery, for diffing. Disposable-stack data only.
// CI uploads OUTCLASS_HYDRATION_CAPTURE_DIR as an artifact when it has files.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const directory = process.env.OUTCLASS_HYDRATION_CAPTURE_DIR || path.join(os.tmpdir(), 'outclass-hydration-captures');
const pattern = /#41[89]|#42[35]|[Hh]ydrat/;
let count = 0;

function captureHydration(page, label = 'page') {
  let last = { url: '', html: '' };
  page.on('response', async response => {
    try { if (response.request().resourceType() === 'document' && response.frame() === page.mainFrame()) last = { url: response.url(), html: await response.text() }; } catch { /* navigation raced the body read */ }
  });
  page.on('pageerror', async error => {
    if (!pattern.test(error.message)) return;
    const id = `${process.pid}-${++count}-${label.replace(/[^a-z0-9-]+/gi, '-')}`;
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, `${id}-meta.json`), JSON.stringify({ page: page.url(), document: last.url, error: error.message.slice(0, 400), at: new Date().toISOString() }, null, 1));
      fs.writeFileSync(path.join(directory, `${id}-server.html`), last.html);
      fs.writeFileSync(path.join(directory, `${id}-client.html`), await page.content());
    } catch (failure) { console.log('Hydration capture failed:', failure.message); }
  });
}
module.exports = { captureHydration, hydrationCaptureDirectory: directory };
