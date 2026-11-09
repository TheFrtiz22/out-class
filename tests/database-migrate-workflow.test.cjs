const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const workflow = fs.readFileSync('.github/workflows/database-migrate.yml', 'utf8')
const steps = workflow.slice(workflow.indexOf('    steps:'))

test('database migrations run only by hand, one database at a time, bound to that database\'s environment', () => {
  assert.match(workflow, /\non:\n  workflow_dispatch:\n/)
  assert.doesNotMatch(workflow, /\n  (push|pull_request|pull_request_target|schedule|workflow_run):/, 'no automatic trigger can migrate a database')
  assert.match(workflow, /options: \[staging, production\]/)
  assert.match(workflow, /environment: \$\{\{ inputs\.environment \}\}/, 'the secret comes from the chosen environment, so production approval rules apply')
  assert.match(workflow, /group: database-migrate-\$\{\{ inputs\.environment \}\}\n  cancel-in-progress: false/, 'a running migration is never cancelled by a second run')
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
