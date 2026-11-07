/**
 * Content fix for public club profiles: removes research notes, source links and
 * "not published" placeholders (rules in lib/public-club-content.ts).
 *
 * FOR OWNER REVIEW. Nothing here has been run against production.
 *
 *   # 1. Rewrite the reviewed import packages in docs/club-profile-design (review with git diff):
 *   node scripts/clean-public-club-profiles.cjs --packages
 *
 *   # 2. Dry run against a database: reads only, writes a review file, changes nothing:
 *   DATABASE_URL=... node scripts/clean-public-club-profiles.cjs --out=club-profile-content-fix.json
 *
 *   # 3. Apply the reviewed changes (owner approval required). --confirm must equal the
 *   #    database name in DATABASE_URL; --actor is the platform admin's user id for the audit log.
 *   DATABASE_URL=... node scripts/clean-public-club-profiles.cjs --apply --confirm=<database> --actor=<userId> --reason="Remove research notes from public profiles"
 *
 * Apply re-reads every row inside its transaction and skips any club whose profile changed
 * after the dry run (compare-and-set on tagline, description and marketing), so a leader's
 * newer edit is never overwritten. Each change writes an AuditLog row with before/after.
 */
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file) {
  const mod = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', source)(require, mod, mod.exports)
  return mod.exports
}
const { cleanPublicProfile } = load('lib/public-club-content.ts')
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [k, ...v] = arg.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true] }))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function changes(before, after) {
  const fields = []
  for (const key of ['tagline', 'description']) if (before[key] !== after[key]) fields.push({ field: key, before: before[key], after: after[key] })
  const mb = before.marketing || {}, ma = after.marketing || {}
  for (const key of new Set([...Object.keys(mb), ...Object.keys(ma)])) if (!same(mb[key], ma[key])) fields.push({ field: `marketing.${key}`, before: mb[key], after: ma[key] })
  return fields
}

function packages() {
  let total = 0
  for (const file of ['profiles.json', 'commerce-expansion.json']) {
    const full = path.join(__dirname, '..', 'docs/club-profile-design', file)
    const data = JSON.parse(fs.readFileSync(full, 'utf8'))
    for (const row of data.profiles) {
      const cleaned = cleanPublicProfile(row.profile)
      total += changes(row.profile, cleaned).length
      row.profile = cleaned
    }
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n')
  }
  console.log(`Rewrote ${total} profile fields in the import packages. Review with: git diff docs/club-profile-design`)
}

async function database() {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required')
  const database = new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '')
  if (args.apply && args.confirm !== database) throw Error(`--apply needs --confirm=${database} (the database name), after owner review of a dry run`)
  if (args.apply && (!args.actor || String(args.reason || '').length < 10)) throw Error('--apply needs --actor=<platform admin user id> and --reason="..." (10+ characters)')
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const clubs = await prisma.club.findMany({ select: { id: true, slug: true, name: true, tagline: true, description: true, marketing: true }, orderBy: { slug: 'asc' } })
    const plan = clubs.map(club => {
      const after = cleanPublicProfile({ tagline: club.tagline, description: club.description, marketing: club.marketing ?? {} })
      return { id: club.id, slug: club.slug, name: club.name, changes: changes({ tagline: club.tagline, description: club.description, marketing: club.marketing ?? {} }, after), after }
    }).filter(item => item.changes.length)
    const out = args.out || 'club-profile-content-fix.json'
    fs.writeFileSync(out, JSON.stringify({ database, generatedAt: new Date().toISOString(), clubs: plan.map(({ after, ...item }) => item) }, null, 2))
    console.log(`${plan.length} of ${clubs.length} clubs would change (${plan.reduce((n, item) => n + item.changes.length, 0)} fields). Review: ${out}`)
    if (!args.apply) { console.log('Dry run only. Nothing was written to the database.'); return }
    let applied = 0, skipped = 0
    for (const item of plan) {
      const original = clubs.find(club => club.id === item.id)
      await prisma.$transaction(async tx => {
        const current = await tx.club.findUnique({ where: { id: item.id }, select: { tagline: true, description: true, marketing: true } })
        if (!current || current.tagline !== original.tagline || current.description !== original.description || !same(current.marketing, original.marketing)) { skipped++; return }
        await tx.club.update({ where: { id: item.id }, data: { tagline: item.after.tagline, description: item.after.description, marketing: item.after.marketing } })
        await tx.auditLog.create({ data: { actorId: String(args.actor), action: 'club.profile.content-fix', targetId: item.id, clubId: item.id, reason: String(args.reason), details: { changes: item.changes } } })
        applied++
      })
    }
    console.log(`Applied ${applied}; skipped ${skipped} changed since the dry run.`)
  } finally {
    await prisma.$disconnect()
  }
}

;(args.packages ? Promise.resolve(packages()) : database()).catch(error => { console.error(error.message); process.exitCode = 1 })
