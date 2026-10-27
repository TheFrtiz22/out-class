const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('playwright');
const { bundle } = require('./helpers/browser-bundle.cjs');

test('streamed route children hydrate without replacing server content when their chunk resolves during a replay', async () => {
  const entry = `
    import React, {lazy, startTransition, useEffect} from 'react';
    import {hydrateRoot} from 'react-dom/client';
    import {RouteContent} from '@/components/route-content';
    const chunk = {status:'pending', then(done) {
      queueMicrotask(() => {chunk.status='fulfilled'; chunk.value={default:<section data-route-body>Ready</section>}; done(chunk.value)});
    }};
    const streamed = lazy(() => chunk);
    function App() {
      useEffect(() => {window.hydrated=true}, []);
      return location.pathname.endsWith('/control') ? <div className="oc-route-content">{streamed}</div> : <RouteContent>{streamed}</RouteContent>;
    }
    window.originalBody = document.querySelector('[data-route-body]'); window.errors=[];
    startTransition(() => hydrateRoot(document.getElementById('root'), <App/>, {onRecoverableError(e){window.errors.push(e.message)}}));
  `;
  const code = { react: bundle(entry), next: bundle(entry, {
    react: "module.exports=require('next/dist/compiled/react')",
    'react/jsx-runtime': "module.exports=require('next/dist/compiled/react/jsx-runtime')",
    'react-dom/client': "module.exports=require('next/dist/compiled/react-dom/client')",
  }) };
  const server = http.createServer((req, res) => {
    const runtime = req.url.split('/')[1].replace('.js', '');
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'application/javascript' : 'text/html');
    res.end(req.url.endsWith('.js') ? code[runtime] : '<div id="root"><div class="oc-route-content"><section data-route-body>Ready</section></div></div><script src="/' + runtime + '.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const runtime of ['react', 'next']) for (const route of ['control', 'guarded']) {
      const page = await browser.newPage();
      try {
        await page.goto('http://127.0.0.1:' + server.address().port + '/' + runtime + '/' + route);
        await page.waitForFunction(() => window.hydrated);
        const result = await page.evaluate(() => ({errors:window.errors, retained:window.originalBody === document.querySelector('[data-route-body]'), wrappers:document.querySelectorAll('.oc-route-content').length}));
        assert.equal(result.wrappers, 1);
        if (route === 'control') {
          assert.ok(result.errors.some(error => error.includes('#418')), 'Control must exercise the installed React hydration replay bug');
          assert.equal(result.retained, false);
        } else {
          assert.deepEqual(result.errors, []);
          assert.equal(result.retained, true, 'Hydration must preserve the original server-rendered node');
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
