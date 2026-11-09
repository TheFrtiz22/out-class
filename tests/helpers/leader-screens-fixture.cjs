/* Builds and serves the isolated leader-screens fixture (tests/fixtures/leader-screens): the club
   workspace on Demo Mode data. Server actions and server-only modules are replaced by a stub that
   throws, so a screen that reaches a live call fails visibly. Local only. */
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os')
const repo = path.resolve(__dirname, '../..')
const { build, serve } = require(path.join(repo, 'scripts/check-floating-header.cjs'))
const stub = path.join(repo, 'tests/fixtures/leader-screens/server-stub.cjs')
const server = /^(@\/actions\/|@\/utils\/(prisma|auth|current-user|supabase\/server|support-audit)$|next\/headers$|server-only$|@prisma\/client)/
async function startLeaderScreens() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outclass-leader-screens-'))
  await build(root, { entry: path.join(repo, 'tests/fixtures/leader-screens/app.jsx'), keep: ['@/contexts/auth-context', '@/contexts/demo-context', '@/lib/application-state', '@/lib/workspace-api'], plugins: webpack => [new webpack.NormalModuleReplacementPlugin(server, resource => { resource.request = stub })] })
  const { server: http, base } = await serve(root)
  return { base, url: query => `${base}/club/x/workspace?${query}`, async close() { await new Promise(resolve => http.close(resolve)); await fs.rm(root, { recursive: true, force: true }) } }
}
module.exports = { startLeaderScreens }
