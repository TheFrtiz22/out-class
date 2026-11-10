/* Builds and serves the isolated Club home fixture (tests/fixtures/club-home). Local only. */
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os')
const repo = path.resolve(__dirname, '../..')
const { build, serve } = require(path.join(repo, 'scripts/check-floating-header.cjs'))
async function startClubHome() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outclass-club-home-'))
  const drawers = path.join(repo, 'tests/fixtures/club-home/drawers.jsx')
  const aliases = Object.fromEntries(['@/components/tasks/dashboard-task', '@/components/events/dashboard-meeting', '@/components/interviews/dashboard-preparation', '@/components/organization-setup-checklist', '@/components/club-home/use-recruiting-strip'].map(key => [`${key}$`, drawers]))
  await build(root, { entry: path.join(repo, 'tests/fixtures/club-home/app.jsx'), aliases })
  const { server, base } = await serve(root)
  return { base, url: query => `${base}/club/fixture-mii/workspace?section=overview&${query}`, async close() { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }) } }
}
/** Visible surfaces (elements or their ::before/::after) whose backdrop-filter is not none. */
function blurredSurfaces() {
  const out = []
  for (const el of document.querySelectorAll('body *')) for (const pseudo of [null, '::before', '::after']) {
    const style = getComputedStyle(el, pseudo), filter = style.backdropFilter || style.webkitBackdropFilter
    if (!filter || filter === 'none' || pseudo && style.content === 'none') continue
    const rect = el.getBoundingClientRect()
    if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 1 || rect.height < 1 || rect.bottom <= 0 || rect.top >= innerHeight) continue
    out.push({ name: `${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter(c => c.startsWith('oc-')).join('.')}${pseudo || ''}`, header: !!el.closest('.oc-product-header'), overlay: !!el.closest('[role="dialog"],[data-slot="sheet-content"],[data-slot="dialog-content"]') })
  }
  return out
}
module.exports = { startClubHome, blurredSurfaces }
