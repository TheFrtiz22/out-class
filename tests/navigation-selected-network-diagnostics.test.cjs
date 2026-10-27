const { test } = require('node:test'), assert = require('node:assert/strict');
const { configuration, errorCategory, resourceCategory } = require('../scripts/navigation-selected-ready-network-diagnostics.cjs');
test('browser network preload refuses non-owned endpoints and stays disabled by default', () => {
  assert.equal(configuration({}), false);
  const env = { OUTCLASS_SELECTED_READY_NETWORK_DIAGNOSTICS: '1', OUTCLASS_SITE_URL: 'http://127.0.0.1:3107', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321', OUTCLASS_SELECTED_READY_DISPOSABLE: 'outclass-onboarding-e2e' };
  assert.equal(configuration(env), true);
  for (const change of [{ OUTCLASS_SITE_URL: 'https://production.example.test' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://production.example.test' }, { OUTCLASS_SELECTED_READY_DISPOSABLE: '' }]) assert.throws(() => configuration({ ...env, ...change }));
});
test('network diagnostic exports only fixed error and resource categories', () => {
  assert.equal(errorCategory('net::ERR_CONTENT_LENGTH_MISMATCH secret-cookie'), 'ERR_CONTENT_LENGTH_MISMATCH');
  assert.equal(errorCategory('net::ERR_PRIVATE_ACTOR_VALUE'), 'other_network_error');
  assert.equal(errorCategory('private email@example.test'), null);
  assert.equal(resourceCategory('http://127.0.0.1:3107/_next/static/chunks/private-value.js?token=secret'), 'script');
  assert.equal(resourceCategory('http://127.0.0.1:3107/api/workspace?args=private'), 'api');
});
