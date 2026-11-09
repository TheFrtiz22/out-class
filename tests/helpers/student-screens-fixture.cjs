/* Builds and serves the isolated student-screens fixture (tests/fixtures/student-screens): Explore, a
   club page and Events on fictional data. Local only; no sessions or server actions. */
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os')
const repo = path.resolve(__dirname, '../..')
const { build, serve } = require(path.join(repo, 'scripts/check-floating-header.cjs'))
async function startStudentScreens() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outclass-student-screens-'))
  const state = path.join(repo, 'tests/fixtures/student-screens/state.jsx')
  const aliases = Object.fromEntries(['@/contexts/auth-context', '@/lib/application-state', '@/contexts/demo-context', '@/lib/workspace-api', '@/components/views/leader-dashboard/live-leader-workspace', '@/actions/typesense-search', '@/contexts/corkboard-context', '@/components/clubs/saved-clubs-popover'].map(key => [`${key}$`, state]))
  await build(root, { entry: path.join(repo, 'tests/fixtures/student-screens/app.jsx'), aliases })
  const { server, base } = await serve(root)
  return { base, url: query => `${base}/explore?${query}`, async close() { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }) } }
}
module.exports = { startStudentScreens }
