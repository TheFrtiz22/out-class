const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const base = process.env.OUTCLASS_LANDING_BASE_URL || 'http://127.0.0.1:3015';
const output = process.env.OUTCLASS_DEMO_AUDIT_DIR || '/tmp/outclass-demo-optimization';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Use a local preview only.');
async function main() {
  fs.mkdirSync(output,{recursive:true});
  const before = execFileSync('git',['show','HEAD:components/landing/hero-feature-stack.css'],{encoding:'utf8'});
  const browser = await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});
  const results=[],errors=[];
  try {
    for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[390,844]]) {
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      const page=await context.newPage();page.setDefaultTimeout(8000);
      page.on('pageerror',error=>errors.push(error.message));
      for(const audience of ['student','leader']) {
        await page.goto(`${base}/?audience=${audience}#top`);
        await page.waitForFunction(a=>document.querySelectorAll('.oc-feature-stack').length===1&&document.querySelector('.oc-landing')?.dataset.landingAudience===a,audience);
        await page.evaluate(()=>document.fonts.ready);
        const metrics=await page.locator('.oc-feature-stack').evaluate(node=>{const card=node.querySelector('[aria-hidden="false"]'),ink=card.firstElementChild,b=card.getBoundingClientRect(),i=ink.getBoundingClientRect();return {width:b.width,height:b.height,inkFits:i.bottom<=b.bottom,overflow:document.documentElement.scrollWidth>innerWidth}});
        assert.equal(metrics.inkFits,true,`${audience} card text fits at ${width}px`);assert.equal(metrics.overflow,false);
        if(width>=1366) {
          const baseline=await page.addStyleTag({content:before});
          await page.screenshot({path:path.join(output,`before-${audience}-hero-${width}x${height}.png`)});
          await baseline.evaluate(node=>node.remove());
          await page.screenshot({path:path.join(output,`after-${audience}-hero-${width}x${height}.png`)});
        }
        await page.getByRole('button',{name:'Next feature',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('.oc-feature-card[aria-hidden="false"]')?.getAttribute('aria-label')==='2 of 6');
        await page.getByRole('button',{name:'Previous feature',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('.oc-feature-card[aria-hidden="false"]')?.getAttribute('aria-label')==='1 of 6');
        if(width===1440||width===390) {
          await page.evaluate(()=>document.activeElement.blur());await page.mouse.move(0,0);
          await page.emulateMedia({reducedMotion:'no-preference'});
          const start=Date.now();
          await page.waitForFunction(()=>document.querySelector('.oc-feature-card[aria-hidden="false"]')?.getAttribute('aria-label')==='2 of 6');
          const autoplayMs=Date.now()-start;
          assert.ok(autoplayMs<5000,`efficient autoplay: ${autoplayMs}ms`);
          await page.getByRole('button',{name:'Pause feature carousel',exact:true}).click();
          await page.evaluate(()=>document.activeElement.blur());await page.mouse.move(0,0);
          await page.waitForTimeout(3800);
          assert.equal(await page.locator('.oc-feature-card[aria-hidden="false"]').getAttribute('aria-label'),'2 of 6','Pause holds the current slide');
          await page.emulateMedia({reducedMotion:'reduce'});
          results.push({audience,width,height,...metrics,autoplayMs});
        } else results.push({audience,width,height,...metrics});
      }
      await context.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'hero-verification.json'),JSON.stringify({results,errors,beforeScreenshots:'Original HEAD hero stylesheet applied in-browser; no source rollback.'},null,2));
    console.log('PASS both hero variations: compact text fit, natural autoplay, Pause, Previous/Next and reduced motion across desktop and phone.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
