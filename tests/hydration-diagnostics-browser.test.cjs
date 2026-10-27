const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('playwright');
const { bundle } = require('./helpers/browser-bundle.cjs');
const { installBrowserObservers } = require('../scripts/navigation-audit.cjs');

test('optional hydration diagnostics capture the component, preserve React reporting and omit private values', async () => {
  const code = bundle(`import React from 'react';import {hydrateRoot} from 'react-dom/client';function HydrationCase(){return <p className="oc-hydration-fixture">Client snapshot</p>}window.originalCalls=0;hydrateRoot(document.getElementById('root'),<HydrationCase/>,{onRecoverableError(){window.originalCalls++}});`);
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/fixture.js' ? 'application/javascript' : 'text/html');
    res.end(req.url === '/fixture.js' ? code : '<div id="root"><p class="oc-hydration-fixture">Server snapshot</p></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const enabled of [false, true]) {
      const context = await browser.newContext();
      await context.addInitScript(installBrowserObservers, { diagnoseHydration: enabled });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.waitForFunction(() => window.originalCalls === 1);
      const diagnostics = await page.evaluate(() => window.__navAudit.hydration);
      assert.equal(diagnostics.length, enabled ? 1 : 0);
      if (enabled) {
        assert.equal(diagnostics[0].code, 418); assert.equal(diagnostics[0].phase, 'initial');
        assert.match(diagnostics[0].stack, /HydrationCase/);
        assert.ok(diagnostics[0].components.some(c => c.classes.includes('oc-hydration-fixture')));
        const redacted = await page.evaluate(() => {
          function Fixture() { return 'oc-fixture'; }
          let original = false;
          const error = Error('Minified React error #418; raw-secret');
          const info = { componentStack: '\n at Fixture (https://example.test/fixture.js?token=raw-secret)' };
          const root = { current: { type: Fixture, memoizedProps: { token: 'raw-secret' } }, onRecoverableError(e, i) { original = e === error && i === info; } };
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot(1, root);
          root.onRecoverableError(error, info);
          return { original, record: window.__navAudit.hydration.at(-1) };
        });
        assert.equal(redacted.original, true); assert.equal(JSON.stringify(redacted.record).includes('raw-secret'), false);
      }
      await context.close();
    }
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
