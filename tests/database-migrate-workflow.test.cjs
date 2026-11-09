const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const workflow = fs.readFileSync('.github/workflows/database-migrate.yml', 'utf8')
const steps = workflow.slice(workflow.indexOf('    steps:'))

test('database migrations run only by hand, one at a time, bound to the production environment', () => {
  assert.match(workflow, /\non:\n  workflow_dispatch:\n/)
  assert.doesNotMatch(workflow, /\n  (push|pull_request|pull_request_target|schedule|workflow_run):/, 'no automatic trigger can migrate a database')
  // There is no staging database: no input can pick a target, so the run always waits for production's reviewers.
  assert.doesNotMatch(workflow, /staging|inputs\.environment/)
  assert.match(workflow, /\n    environment: production\n/, 'the secret comes from the production environment, so its approval rules apply')
  assert.match(workflow, /group: database-migrate-production\n  cancel-in-progress: false/, 'a running migration is never cancelled by a second run')
  assert.match(workflow, /\npermissions:\n  contents: read\n/)
})

test('a dry run is the default and applies nothing', () => {
  assert.match(workflow, /dry_run:[\s\S]*?type: boolean\n        default: true/)
  for (const step of ['Apply migrations', 'Confirm the history is current']) {
    assert.match(workflow, new RegExp(`name: ${step}\\n        if: \\$\\{\\{ !inputs\\.dry_run \\}\\}`), `${step} is skipped on a dry run`)
  }
})

test('only Prisma migrate deploy changes the database, after the migration-path guard', () => {
  assert.equal((workflow.match(/prisma migrate deploy/g) || []).length, 1)
  assert.doesNotMatch(workflow, /migrate (reset|dev)|db push|db execute|--accept-data-loss|--force-reset|supabase /)
  assert.ok(steps.indexOf('check-migration-path.cjs') < steps.indexOf('prisma migrate deploy'))
})

test('the connection string stays a secret and inputs never reach a shell line', () => {
  assert.match(workflow, /DATABASE_URL: \$\{\{ secrets\.MIGRATION_DATABASE_URL \}\}/)
  assert.doesNotMatch(workflow, /echo[^\n]*\$DATABASE_URL|printenv|\benv\b\s*$|set -x/m, 'the URL is never printed')
  // Inside the steps, an input may appear only as the checkout ref or in a step condition, never in a shell line.
  for (const line of steps.split('\n').filter(line => /\$\{\{\s*(inputs|github\.event)/.test(line))) {
    assert.match(line, /^\s+(ref|if): /, `no expression interpolation in shell: ${line.trim()}`)
  }
  assert.match(workflow, /persist-credentials: false/)
})

test('a dry run passes only when status lists pending migrations, never on a connection or history error', () => {
  const step = steps.slice(steps.indexOf('name: Pending migrations'), steps.indexOf('name: Apply migrations'))
  assert.doesNotMatch(step, /\|\|\s*(echo|true)/, 'status failures are not swallowed')
  assert.match(step, /Following migrations\? ha\(s\|ve\) not yet been applied/)
  assert.match(step, /error\|failed\|P1\[0-9\]\{3\}\|P3\[0-9\]\{3\}\|are different\|drift/)
  assert.match(step, /\n {10}exit 1$/m)
})

test('the status classifier accepts pending migrations and rejects real failures', () => {
  const { execFileSync } = require('node:child_process'), os = require('node:os'), path = require('node:path')
  const step = steps.slice(steps.indexOf('name: Pending migrations'), steps.indexOf('name: Apply migrations'))
  const script = step.slice(step.indexOf('run: |') + 6).split('\n').map(line => line.slice(10)).join('\n')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-status-'))
  const run = (output, code) => {
    fs.writeFileSync(path.join(dir, 'pnpm'), `#!/bin/sh\ncat <<'OUT'\n${output}\nOUT\nexit ${code}\n`, { mode: 0o755 })
    try { execFileSync('bash', ['-c', script], { env: { PATH: `${dir}:${process.env.PATH}`, RUNNER_TEMP: dir }, stdio: 'pipe' }); return 0 } catch (error) { return error.status }
  }
  assert.equal(run('Database schema is up to date!', 0), 0)
  assert.equal(run('Following migration have not yet been applied:\n20261109120000_club_short_name', 1), 0)
  assert.equal(run('Following migrations have not yet been applied:\na\nb', 1), 0)
  assert.equal(run("Error: P1001: Can't reach database server at `db.example:5432`", 1), 1)
  assert.equal(run('Error: P1000: Authentication failed against database server', 1), 1)
  assert.equal(run('Following migration have failed:\n20261109120000_club_short_name', 1), 1)
  assert.equal(run('Your local migration history and the migrations table from your database are different', 1), 1)
  fs.rmSync(dir, { recursive: true, force: true })
})
