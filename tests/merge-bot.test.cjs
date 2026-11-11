const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { evaluate, protectedFiles, requiredChecksStatus, lastLabeler, MERGE_LABEL } = require("../.github/scripts/merge-bot.cjs")

const REPO = "TheFrtiz22/out-class"
const REQUIRED = ["validate", "Native PostgreSQL / security"]

function pass(name, started = "2026-11-11T10:00:00Z") {
  return { name, status: "completed", conclusion: "success", started_at: started }
}

function base(overrides = {}) {
  return {
    pr: {
      state: "open",
      draft: false,
      base: { ref: "main" },
      head: { repo: { full_name: REPO }, sha: "abc" },
      labels: [{ name: MERGE_LABEL }],
      mergeable: true,
      mergeable_state: "clean",
      ...overrides.pr,
    },
    repoFullName: REPO,
    filenames: overrides.filenames ?? ["components/button.tsx"],
    requiredContexts: overrides.requiredContexts ?? REQUIRED,
    checkRuns: overrides.checkRuns ?? REQUIRED.map((name) => pass(name)),
    issueEvents: overrides.issueEvents ?? [{ event: "labeled", label: { name: MERGE_LABEL }, actor: { login: "TheFrtiz22" } }],
    allowedLabelers: ["TheFrtiz22"],
  }
}

test("merges a labelled PR whose required checks passed", () => {
  assert.deepEqual(evaluate(base()), { merge: true })
})

test("never merges migrations, schema, workflows or guardrails", () => {
  for (const file of [
    "prisma/migrations/20261111090000_x/migration.sql",
    "prisma/schema.prisma",
    ".github/workflows/deploy.yml",
    ".claude/settings.json",
    "supabase/config.toml",
    "middleware.ts",
  ]) {
    const result = evaluate(base({ filenames: ["app/page.tsx", file] }))
    assert.equal(result.merge, false, file)
    assert.equal(result.final, true, file)
  }
  assert.deepEqual(protectedFiles(["lib/prisma.ts", "app/prisma/page.tsx"]), [])
})

test("refuses Apply before merge, do-not-merge, drafts, forks and other bases", () => {
  assert.equal(evaluate(base({ pr: { labels: [{ name: MERGE_LABEL }, { name: "Apply before merge" }] } })).merge, false)
  assert.equal(evaluate(base({ pr: { labels: [{ name: MERGE_LABEL }, { name: "do-not-merge" }] } })).merge, false)
  assert.equal(evaluate(base({ pr: { draft: true } })).merge, false)
  assert.equal(evaluate(base({ pr: { head: { repo: { full_name: "someone/fork" }, sha: "abc" } } })).merge, false)
  assert.equal(evaluate(base({ pr: { base: { ref: "release" } } })).merge, false)
})

test("only acts on a label applied by an allowed account", () => {
  const stranger = [{ event: "labeled", label: { name: MERGE_LABEL }, actor: { login: "someone-else" } }]
  assert.equal(evaluate(base({ issueEvents: stranger })).merge, false)
  const removed = [
    { event: "labeled", label: { name: MERGE_LABEL }, actor: { login: "TheFrtiz22" } },
    { event: "unlabeled", label: { name: MERGE_LABEL }, actor: { login: "TheFrtiz22" } },
  ]
  assert.equal(lastLabeler(removed), null)
})

test("waits for missing or running required checks and stops on failures", () => {
  const waiting = evaluate(base({ checkRuns: [pass("validate")] }))
  assert.equal(waiting.merge, false)
  assert.match(waiting.reason, /waiting on Native PostgreSQL/)
  assert.ok(!waiting.final)

  const failed = evaluate(base({ checkRuns: [pass("validate"), { name: REQUIRED[1], status: "completed", conclusion: "failure", started_at: "2026-11-11T10:00:00Z" }] }))
  assert.match(failed.reason, /failed/)
  assert.ok(!failed.final)

  assert.equal(evaluate(base({ requiredContexts: [] })).merge, false)
})

test("a successful re-run replaces an earlier failed attempt", () => {
  const runs = [
    pass("validate"),
    { name: REQUIRED[1], status: "completed", conclusion: "failure", started_at: "2026-11-11T09:00:00Z" },
    pass(REQUIRED[1], "2026-11-11T09:30:00Z"),
  ]
  assert.equal(requiredChecksStatus(REQUIRED, runs).ok, true)
})

test("waits on conflicts and uncomputed mergeability", () => {
  assert.equal(evaluate(base({ pr: { mergeable: false, mergeable_state: "dirty" } })).merge, false)
  assert.equal(evaluate(base({ pr: { mergeable: null } })).merge, false)
})

test("workflow is off by default, pins the head SHA and never checks out PR code", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/merge-bot.yml"), "utf8")
  assert.match(workflow, /if: vars\.MERGE_BOT_ENABLED == 'true'/)
  assert.match(workflow, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/)
  assert.doesNotMatch(workflow, /github\.event\.pull_request\.head/)
  const script = fs.readFileSync(path.join(__dirname, "../.github/scripts/merge-bot.cjs"), "utf8")
  assert.match(script, /sha: pr\.head\.sha/)
})
