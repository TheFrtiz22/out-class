// Read-only visual audit of the local landing page. Screenshots use its native
// reduced-motion presentation for repeatable before/after comparisons.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
async function main() {
  const phase = process.argv[2] || 'after';
  const base = process.env.OUTCLASS_DEMO_AUDIT_URL || 'http://127.0.0.1:3117';
  const output = process.env.OUTCLASS_DEMO_AUDIT_DIR || '/tmp/outclass-demo-optimization';
  if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Run the visual audit against a local preview only.');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
  const results = [];
  try {
    for (const [width, height] of [[1366,768],[1440,900],[1920,1080],[768,1024],[390,844]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      for (const audience of ['leader','student']) {
        await page.goto(`${base}/?audience=${audience}#top`, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForFunction(audience => document.querySelectorAll('#product-journey').length === 1 && document.querySelector('#product-journey')?.dataset.perspective === audience, audience);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const count = await page.locator('.oc-product-story').count();
        for (let index = 0; index < count; index++) {
          const article = page.locator('.oc-product-story').nth(index);
          await article.evaluate(node => window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - 104, behavior: 'instant' }));
          await page.waitForTimeout(100);
          const measure = await article.evaluate(node => {
            const box = el => { const { x,y,width,height,bottom } = el.getBoundingClientRect(); return { x,y,width,height,bottom } };
            const frame = node.querySelector('.oc-story-frame'), surface = node.querySelector('.oc-story-interface');
            return { scene: node.querySelector('[data-demo-scene]').dataset.demoScene, article: box(node), frame: box(frame), headline: box(node.querySelector('h2')), surface: box(surface), documentOverflow: document.documentElement.scrollWidth > innerWidth, surfaceOverflow: surface.scrollHeight > surface.clientHeight + 1 };
          });
          if (width >= 1366) {
            measure.screenshot = `${phase}-${audience}-${measure.scene}-${width}x${height}.png`;
            await page.screenshot({ path: path.join(output, measure.screenshot) });
          }
          results.push({ audience, width, height, ...measure });
          if (phase === 'after') {
            assert.equal(measure.documentOverflow, false, `${audience}/${measure.scene}: page overflow at ${width}px`);
            if (width >= 1366) {
              assert.ok(measure.frame.height <= height * .51, `${measure.scene}: preview fits half the viewport`);
              assert.ok(measure.frame.bottom < height && measure.headline.bottom < height, `${measure.scene}: headline and complete frame fit together`);
            }
          }
        }
      }
      await context.close();
    }
    fs.writeFileSync(path.join(output, `${phase}-measurements.json`), JSON.stringify(results, null, 2));
    const pairs = fs.readdirSync(output).filter(name => name.startsWith('after-') && name.endsWith('.png') && fs.existsSync(path.join(output, name.replace('after-', 'before-'))));
    fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OutClass demo comparisons</title><style>body{font:16px system-ui;background:#f3eee5;color:#142d45;margin:32px}h1{font:40px Georgia}section{margin:48px 0}figure{margin:0}img{width:100%;border:1px solid #142d4520;border-radius:12px}article{display:grid;grid-template-columns:1fr 1fr;gap:16px}figcaption{padding:12px 0}a{color:inherit}@media(max-width:800px){article{grid-template-columns:1fr}}</style><h1>OutClass · Compact product demonstrations</h1><p>Matching viewport captures, using the page’s native reduced-motion completed state. Each pair includes the headline and full preview placement.</p>${pairs.map(after => `<section><h2>${after.slice(6,-4).replaceAll('-', ' ')}</h2><article><figure><a href="${after.replace('after-','before-')}"><img loading="lazy" src="${after.replace('after-','before-')}" alt="Before"></a><figcaption>Before</figcaption></figure><figure><a href="${after}"><img loading="lazy" src="${after}" alt="After"></a><figcaption>After</figcaption></figure></article></section>`).join('')}</html>`);
    console.log(JSON.stringify({ phase, scenes: results.length, screenshots: results.filter(r=>r.screenshot).length, overflow: results.filter(r=>r.documentOverflow).map(r=>({audience:r.audience,scene:r.scene,width:r.width})), frameRange: [Math.min(...results.map(r=>r.frame.height)),Math.max(...results.map(r=>r.frame.height))] }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1 });
