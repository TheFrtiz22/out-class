const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { actionsClient, evaluate, protectedFiles, requiredChecksStatus, lastLabeler, latestApproval, checkProvenanceProblems, MERGE_LABEL } = require("../.github/scripts/merge-bot.cjs")

const REPO = "TheFrtiz22/out-class"
const REQUIRED = ["validate", "Native PostgreSQL / security"]
const REQUIRED_CHECKS = REQUIRED.map((context) => ({ context, integration_id: 15368 }))
const SHA = "a".repeat(40)
const approval = (sha = SHA, login = "github-actions[bot]", type = "Bot") => ({ user: { login, type }, body: `ok\n<!-- merge-bot-approved:${sha} by:TheFrtiz22 -->` })

function pass(name, started = "2026-11-11T10:00:00Z") {
  return { name, status: "completed", conclusion: "success", started_at: started, app: { id: 15368 }, check_suite: { id: 1 } }
}

function base(overrides = {}) {
  return {
    pr: {
      state: "open",
      draft: false,
      base: { ref: "main" },
      head: { repo: { full_name: REPO }, sha: SHA },
      labels: [{ name: MERGE_LABEL }],
      mergeable: true,
      mergeable_state: "clean",
      ...overrides.pr,
    },
    repoFullName: REPO,
    files: overrides.files ?? [{ filename: "components/button.tsx" }],
    requiredChecks: overrides.requiredChecks ?? REQUIRED_CHECKS,
    comments: overrides.comments ?? [approval()],
    checkRuns: overrides.checkRuns ?? REQUIRED.map((name) => pass(name)),
    issueEvents: overrides.issueEvents ?? [{ event: "labeled", label: { name: MERGE_LABEL }, actor: { login: "TheFrtiz22" } }],
    allowedLabelers: ["TheFrtiz22"],
  }
}

test("merges a labelled PR whose required checks passed", () => {
  assert.equal(evaluate(base()).merge, true)
})

test("never merges migrations, schema, workflows or guardrails", () => {
  for (const file of [
    "prisma/migrations/20261111090000_x/migration.sql",
    "prisma/schema.prisma",
    ".github/workflows/deploy.yml",
    ".claude/settings.json",
    "supabase/config.toml",
    "middleware.ts",
    "package.json",
    "pnpm-lock.yaml",
    "next.config.mjs",
    "instrumentation.ts",
    "scripts/check-release-database.cjs",
    "lib/auth-session.ts",
    "contexts/auth-context.tsx",
    "lib/password-policy.ts",
    "lib/rate-limit-core.ts",
    "app/api/internal/notification-delivery/route.ts",
    "docs/agent-ops/decision-log.md",
    "CLAUDE.md",
  ]) {
    const result = evaluate(base({ files: [{ filename: "app/page.tsx" }, { filename: file }] }))
    assert.equal(result.merge, false, file)
    assert.equal(result.final, true, file)
  }
  assert.deepEqual(protectedFiles(["lib/prisma.ts", "app/prisma/page.tsx", "docs/legal.md"]), [])
  // A rename out of a protected path still counts.
  assert.deepEqual(protectedFiles([{ filename: "lib/x.sql", previous_filename: "prisma/migrations/1/migration.sql" }]), ["prisma/migrations/1/migration.sql"])
})

test("refuses Apply before merge, do-not-merge, drafts, forks and other bases", () => {
  assert.equal(evaluate(base({ pr: { labels: [{ name: MERGE_LABEL }, { name: "Apply before merge" }] } })).merge, false)
  assert.equal(evaluate(base({ pr: { labels: [{ name: MERGE_LABEL }, { name: "do-not-merge" }] } })).merge, false)
  assert.equal(evaluate(base({ pr: { draft: true } })).merge, false)
  assert.equal(evaluate(base({ pr: { head: { repo: { full_name: "someone/fork" }, sha: SHA } } })).merge, false)
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

  const failed = evaluate(base({ checkRuns: [pass("validate"), { name: REQUIRED[1], status: "completed", conclusion: "failure", started_at: "2026-11-11T10:00:00Z", app: { id: 15368 } }] }))
  assert.match(failed.reason, /failed/)
  assert.ok(!failed.final)

  assert.equal(evaluate(base({ requiredChecks: [] })).merge, false)
})

test("a successful re-run replaces an earlier failed attempt", () => {
  const runs = [
    pass("validate"),
    { name: REQUIRED[1], status: "completed", conclusion: "failure", started_at: "2026-11-11T09:00:00Z", app: { id: 15368 } },
    pass(REQUIRED[1], "2026-11-11T09:30:00Z"),
  ]
  assert.equal(requiredChecksStatus(REQUIRED_CHECKS, runs).ok, true)
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
  assert.match(workflow, /persist-credentials: false/)
})

test("approval is pinned to the head commit and must come from the bot", () => {
  // Label applied at an older commit, then someone pushed: no merge.
  const moved = evaluate(base({ comments: [approval("b".repeat(40))] }))
  assert.equal(moved.merge, false)
  assert.equal(moved.final, true)
  // A marker typed by a person (or an agent on the owner's account) is ignored.
  assert.equal(latestApproval([approval(SHA, "TheFrtiz22", "User")]), null)
  assert.equal(evaluate(base({ comments: [] })).merge, false)
})

test("required checks only count from GitHub Actions, and only from allowed workflow runs of this commit", () => {
  const fake = REQUIRED.map((name) => ({ ...pass(name), app: { id: 999 } }))
  assert.equal(evaluate(base({ checkRuns: fake })).merge, false)

  const passed = [pass("validate")]
  const ok = new Map([[1, { path: ".github/workflows/deploy.yml", head_sha: SHA, head_repository: { full_name: REPO }, event: "pull_request" }]])
  assert.deepEqual(checkProvenanceProblems(passed, ok, { headSha: SHA, repoFullName: REPO }), [])
  const other = new Map([[1, { path: ".github/workflows/fake.yml", head_sha: SHA, head_repository: { full_name: REPO }, event: "pull_request" }]])
  assert.equal(checkProvenanceProblems(passed, other, { headSha: SHA, repoFullName: REPO }).length, 1)
  assert.equal(checkProvenanceProblems(passed, new Map(), { headSha: SHA, repoFullName: REPO }).length, 1)
  const otherSha = new Map([[1, { ...ok.get(1), head_sha: "c".repeat(40) }]])
  assert.equal(checkProvenanceProblems(passed, otherSha, { headSha: SHA, repoFullName: REPO }).length, 1)
})

test("the approval client uses the workflow token even without getOctokit", () => {
  class FakeOctokit { constructor(options) { this.options = options } }
  const github = new FakeOctokit({ auth: "pat" })
  const client = actionsClient({ github, token: "workflow-token" })
  assert.equal(client.options.auth, "workflow-token")
  assert.ok(client instanceof FakeOctokit)
  assert.throws(() => actionsClient({ github, token: "" }))
  const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/merge-bot.yml"), "utf8")
  assert.doesNotMatch(workflow, /getOctokit/)
})
