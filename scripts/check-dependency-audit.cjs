#!/usr/bin/env node
// CI gate: `pnpm audit --audit-level=high --prod`, minus the documented exceptions in
// .github/audit-allowlist.json. Fails closed: an audit that cannot run or cannot be parsed fails,
// as does an expired or incomplete allowlist entry. Moderate and low advisories are printed only.
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const BLOCKING = new Set(['high', 'critical'])
const MAX_EXCEPTION_DAYS = 90
const DAY = 24 * 60 * 60 * 1000

function loadAllowlist(file, now = new Date()) {
  const { advisories } = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(advisories)) throw new Error('allowlist: "advisories" must be an array')
  const problems = []
  for (const entry of advisories) {
    const label = entry?.id ?? '(no id)'
    for (const field of ['id', 'package', 'reason', 'mitigation', 'expires']) if (typeof entry?.[field] !== 'string' || !entry[field].trim()) problems.push(`${label}: missing ${field}`)
    const expires = new Date(`${entry?.expires}T23:59:59Z`)
    if (Number.isNaN(expires.getTime())) problems.push(`${label}: invalid expires date`)
    else if (expires < now) problems.push(`${label}: exception expired on ${entry.expires}; fix the dependency or re-review and extend it`)
    else if (expires - now > MAX_EXCEPTION_DAYS * DAY) problems.push(`${label}: expires more than ${MAX_EXCEPTION_DAYS} days out`)
  }
  return { ids: new Set(advisories.map(entry => entry?.id)), problems }
}

/** Splits the advisories of `pnpm audit --json` output into blocking, allowed and informational. */
function evaluate(report, allowedIds) {
  if (!report || typeof report !== 'object' || !report.advisories || typeof report.advisories !== 'object') throw new Error('audit output has no advisories object')
  const result = { blocking: [], allowed: [], informational: [] }
  for (const advisory of Object.values(report.advisories)) {
    const item = { id: advisory.github_advisory_id || String(advisory.id), module: advisory.module_name, severity: advisory.severity, title: advisory.title, patched: advisory.patched_versions }
    if (!BLOCKING.has(item.severity)) result.informational.push(item)
    else if (allowedIds.has(item.id)) result.allowed.push(item)
    else result.blocking.push(item)
  }
  return result
}

function main() {
  const root = path.join(__dirname, '..')
  const allowlist = loadAllowlist(path.join(root, '.github/audit-allowlist.json'))
  const run = spawnSync('pnpm', ['audit', '--audit-level=high', '--prod', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  let report
  try { report = JSON.parse(run.stdout) } catch { report = undefined }
  if (run.error || !report || report.error) {
    console.error('pnpm audit did not produce a report (registry unreachable or failed); failing closed.')
    if (report?.error) console.error(report.error.summary || report.error.code || 'unknown audit error')
    process.exit(2)
  }
  const { blocking, allowed, informational } = evaluate(report, allowlist.ids)
  const line = item => `  ${item.severity.padEnd(8)} ${item.module} ${item.id} (patched: ${item.patched}) ${item.title}`
  if (informational.length) console.log(`Below the high threshold (not blocking):\n${informational.map(line).join('\n')}`)
  if (allowed.length) console.log(`Allowed by .github/audit-allowlist.json:\n${allowed.map(line).join('\n')}`)
  const reported = new Set([...allowed, ...blocking].map(item => item.id))
  for (const id of allowlist.ids) if (!reported.has(id)) console.log(`Note: allowlisted ${id} is no longer reported; remove it from the allowlist.`)
  if (allowlist.problems.length) console.error(`Allowlist problems:\n  ${allowlist.problems.join('\n  ')}`)
  if (blocking.length) console.error(`High or critical advisories without a documented exception:\n${blocking.map(line).join('\n')}`)
  if (blocking.length || allowlist.problems.length) process.exit(1)
  console.log('Dependency audit passed: no unallowed high or critical advisories in production dependencies.')
}

if (require.main === module) main()
module.exports = { evaluate, loadAllowlist }
