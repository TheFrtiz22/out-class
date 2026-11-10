/* Builds and serves the isolated list-pages fixture (tests/fixtures/list-pages): the real Members and
   Announcements lists on fictional records. Server actions and server-only modules are replaced by a stub
   that throws, so a list that reaches a live call fails visibly. Local only. */
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os')
const repo = path.resolve(__dirname, '../..')
const { build, serve } = require(path.join(repo, 'scripts/check-floating-header.cjs'))
const stub = path.join(repo, 'tests/fixtures/leader-screens/server-stub.cjs')
const server = /^(@\/actions\/|@\/utils\/(prisma|auth|current-user|supabase\/server|support-audit)$|next\/headers$|server-only$|@prisma\/client)/
async function startListPages() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outclass-list-pages-'))
  await build(root, { entry: path.join(repo, 'tests/fixtures/list-pages/app.jsx'), aliases: { '@/lib/workspace-read$': path.join(repo, 'tests/fixtures/list-pages/reads.js') }, plugins: webpack => [new webpack.NormalModuleReplacementPlugin(server, resource => { resource.request = stub })] })
  const { server: http, base } = await serve(root)
  return { base, url: query => `${base}/club/fixture-mii/workspace?${query}`, async close() { await new Promise(resolve => http.close(resolve)); await fs.rm(root, { recursive: true, force: true }) } }
}
module.exports = { startListPages }
