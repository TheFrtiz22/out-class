// Standalone local diagnostic preload; never changes requests or application code.
const assert = require('node:assert/strict');
const codes = new Set(['ERR_ABORTED', 'ERR_FAILED', 'ERR_CONNECTION_RESET', 'ERR_CONNECTION_CLOSED', 'ERR_EMPTY_RESPONSE', 'ERR_TIMED_OUT', 'ERR_CONTENT_LENGTH_MISMATCH', 'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_NETWORK_CHANGED', 'ERR_CACHE_MISS', 'ERR_HTTP2_PROTOCOL_ERROR', 'ERR_INSUFFICIENT_RESOURCES', 'ERR_NETWORK_IO_SUSPENDED']);
function errorCategory(value) {
  const match = String(value).match(/net::(ERR_[A-Z_]+)/);
  return match ? (codes.has(match[1]) ? match[1] : 'other_network_error') : null;
}
function configuration(env = process.env) {
  if (env.OUTCLASS_SELECTED_READY_NETWORK_DIAGNOSTICS !== '1') return false;
  assert.equal(env.OUTCLASS_SITE_URL, 'http://127.0.0.1:3107');
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:55321');
  assert.equal(env.OUTCLASS_SELECTED_READY_DISPOSABLE, 'outclass-onboarding-e2e');
  return true;
}
function resourceCategory(url) {
  const path = new URL(url).pathname;
  if (path.startsWith('/_next/static/chunks/')) return 'script';
  if (path.startsWith('/_next/static/media/')) return 'media';
  if (path.startsWith('/api/')) return 'api';
  return 'other';
}
module.exports = { errorCategory, configuration, resourceCategory };
if (configuration()) {
  const { chromium } = require('playwright'), { randomUUID } = require('node:crypto');
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args), newContext = browser.newContext.bind(browser);
    browser.newContext = async (...options) => {
      const context = await newContext(...options), contextId = randomUUID();
      const emit = value => console.log(JSON.stringify({ event: 'selected.network', at: new Date().toISOString(), contextId, ...value }));
      context.on('page', page => {
        page.on('requestfailed', request => emit({ type: 'request_failed', resource: resourceCategory(request.url()), networkError: errorCategory(request.failure()?.errorText) }));
        page.on('pageerror', error => emit({ type: 'page_error', name: ['Error', 'TypeError', 'ReferenceError', 'ChunkLoadError'].includes(error.name) ? error.name : 'other', networkError: errorCategory(error.message), chunkLoadFailure: /ChunkLoadError|Loading chunk [0-9]+ failed/.test(error.message), hydrationFailure: /Minified React error #418/.test(error.message) }));
      });
      return context;
    };
    return browser;
  };
}
