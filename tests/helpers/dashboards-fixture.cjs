/* Builds and serves the isolated dashboards fixture (tests/fixtures/dashboards): Personal Home and
   Recruiting Overview on fictional data. Local only; no sessions or server actions. */
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os')
const repo = path.resolve(__dirname, '../..')
const { build, serve } = require(path.join(repo, 'scripts/check-floating-header.cjs'))
async function startDashboards() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outclass-dashboards-'))
  const state = path.join(repo, 'tests/fixtures/dashboards/state.jsx')
  const aliases = Object.fromEntries(['@/contexts/auth-context', '@/lib/application-state', '@/contexts/demo-context', '@/contexts/corkboard-context', '@/lib/workspace-api', '@/components/views/leader-dashboard/live-leader-workspace', '@/components/recruiting-insights-card', '@/components/calendar-subscribe'].map(key => [`${key}$`, state]))
  await build(root, { entry: path.join(repo, 'tests/fixtures/dashboards/app.jsx'), aliases })
  const { server, base } = await serve(root)
  return { base, url: query => `${base}/club/fixture-mii/workspace?${query}`, async close() { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }) } }
}
module.exports = { startDashboards }
