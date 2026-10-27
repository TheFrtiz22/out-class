// Two fixed, disposable profiles. An arbitrary app, project or database is never accepted.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { readConfig } = require('../tests/helpers/onboarding-e2e.cjs');

function fixtureProfile(hydration = false) {
  if (!hydration) return { root: path.join(os.tmpdir(), 'outclass-onboarding-e2e'), projectId: 'outclass-onboarding-e2e', appUrl: 'http://127.0.0.1:3107', readConfig };
  assert.ok(hydration === true || hydration === 'crossover', 'Unknown disposable fixture profile');
  const crossover = hydration === 'crossover';
  const projectId = crossover ? 'outclass-navigation-crossover-e2e' : 'outclass-hydration-e2e';
  const appPort = crossover ? '3119' : '3117', prefix = crossover ? '593' : '583';
  return {
    root: path.join(os.tmpdir(), projectId), projectId, appUrl: 'http://127.0.0.1:' + appPort,
    readConfig(filename) {
      const config = JSON.parse(fs.readFileSync(filename));
      assert.equal(config.projectId, projectId);
      for (const [value, port] of [[config.appUrl, appPort], [config.status.API_URL, prefix + '21'], [config.status.DB_URL, prefix + '22'], [config.status.MAILPIT_URL, prefix + '24']]) {
        const url = new URL(value);
        assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Hydration checks require loopback services');
        assert.equal(url.port, port, 'Hydration checks require their dedicated ports');
      }
      return config;
    },
  };
}

module.exports = { fixtureProfile };
