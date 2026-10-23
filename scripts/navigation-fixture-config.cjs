// Two fixed, disposable profiles. An arbitrary app, project or database is never accepted.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { readConfig } = require('../tests/helpers/onboarding-e2e.cjs');

function fixtureProfile(hydration = false) {
  if (!hydration) return { root: path.join(os.tmpdir(), 'outclass-onboarding-e2e'), projectId: 'outclass-onboarding-e2e', appUrl: 'http://127.0.0.1:3107', readConfig };
  return {
    root: path.join(os.tmpdir(), 'outclass-hydration-e2e'), projectId: 'outclass-hydration-e2e', appUrl: 'http://127.0.0.1:3117',
    readConfig(filename) {
      const config = JSON.parse(fs.readFileSync(filename));
      assert.equal(config.projectId, 'outclass-hydration-e2e');
      for (const [value, port] of [[config.appUrl, '3117'], [config.status.API_URL, '58321'], [config.status.DB_URL, '58322'], [config.status.MAILPIT_URL, '58324']]) {
        const url = new URL(value);
        assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Hydration checks require loopback services');
        assert.equal(url.port, port, 'Hydration checks require their dedicated ports');
      }
      return config;
    },
  };
}

module.exports = { fixtureProfile };
