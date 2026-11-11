"use strict"

// Merge bot: merges a pull request into main once an allowed account has
// labelled it `merge-when-green` AT ITS CURRENT HEAD COMMIT and every check
// required by the main ruleset has passed on that commit, produced by a
// GitHub Actions run of an allowed workflow file for this PR.
//
// Approval is pinned to a commit: when the label is applied, the bot records
// the head SHA in a comment written with the workflow's own GITHUB_TOKEN
// (author github-actions[bot]). Any later push changes the head SHA, so the
// approval no longer matches and the bot removes the label.
//
// It never merges a PR that touches database, build, deploy, auth, cron or
// agent-guardrail paths (including renames out of them), that carries
// "Apply before merge" or "do-not-merge", that is a draft, or that comes
// from a fork. Those stay the owner's to merge by hand.

const MERGE_LABEL = "merge-when-green"
const BLOCKING_LABELS = ["Apply before merge", "do-not-merge"]
const APPROVAL_AUTHOR = "github-actions[bot]"
const APPROVAL_MARKER = /<!-- merge-bot-approved:([0-9a-f]{40}) by:([A-Za-z0-9-]+) -->/
const ACTIONS_APP_ID = 15368
// Workflow files whose runs may satisfy required checks.
const ALLOWED_CHECK_WORKFLOWS = [".github/workflows/deploy.yml", ".github/workflows/disposable-integrations.yml"]

const PROTECTED_PATHS = [
  // Database and Supabase
  /^prisma\//,
  /^supabase\//,
  // CI, agents and repo instructions
  /^\.github\//,
  /^\.claude\//,
  /^docs\/agent-ops\//,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  // Build and install: these run inside the Vercel production build
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^\.npmrc$/,
  /^\.pnpmfile\.c?js$/,
  /^\.nvmrc$/,
  /^scripts\//,
  /^next\.config\./,
  /^vercel\.json$/,
  /^instrumentation(-client)?\.[cm]?[jt]s$/,
  /^(src\/)?middleware\.[cm]?[jt]s$/,
  // Auth, sessions, admin elevation and cron
  /^lib\/auth[^/]*$/,
  /^lib\/admin-elevation\.ts$/,
  /^lib\/supabase\//,
  /^utils\/supabase\//,
  /^app\/api\/auth\//,
  /^app\/api\/internal\//,
  /^app\/auth\//,
]

function protectedFiles(files) {
  const names = files.flatMap((file) =>
    typeof file === "string" ? [file] : [file.filename, file.previous_filename].filter(Boolean),
  )
  return [...new Set(names.filter((name) => PROTECTED_PATHS.some((pattern) => pattern.test(name))))]
}

// Latest check run per name wins (re-runs replace earlier attempts). Only
// check runs created by GitHub Actions count.
function latestRunsByName(checkRuns, appId = ACTIONS_APP_ID) {
  const latest = new Map()
  for (const run of checkRuns) {
    if (run.app?.id !== appId) continue
    const previous = latest.get(run.name)
    const started = Date.parse(run.started_at || 0)
    if (!previous || started > Date.parse(previous.started_at || 0)) latest.set(run.name, run)
  }
  return latest
}

// requiredChecks: [{ context, integration_id }]
function requiredChecksStatus(requiredChecks, checkRuns) {
  const missing = []
  const pending = []
  const failed = []
  const passed = []
  for (const { context, integration_id: appId } of requiredChecks) {
    const run = latestRunsByName(checkRuns, appId ?? ACTIONS_APP_ID).get(context)
    if (!run) missing.push(context)
    else if (run.status !== "completed") pending.push(context)
    else if (run.conclusion !== "success") failed.push(`${context} (${run.conclusion})`)
    else passed.push(run)
  }
  return { ok: !missing.length && !pending.length && !failed.length, missing, pending, failed, passed }
}

// Who last applied the merge label (from issue events).
function lastLabeler(issueEvents, label = MERGE_LABEL) {
  let actor = null
  for (const event of issueEvents) {
    if (event.label?.name !== label) continue
    if (event.event === "labeled") actor = event.actor?.login ?? null
    if (event.event === "unlabeled") actor = null
  }
  return actor
}

// The most recent approval the bot itself recorded.
function latestApproval(comments) {
  let approval = null
  for (const comment of comments) {
    if (comment.user?.login !== APPROVAL_AUTHOR || comment.user?.type !== "Bot") continue
    const match = APPROVAL_MARKER.exec(comment.body || "")
    if (match) approval = { sha: match[1], by: match[2] }
  }
  return approval
}

// A passing required check must come from a workflow run of an allowed
// workflow file, for this PR's head commit, in this repository.
function checkProvenanceProblems(passedRuns, workflowRunsBySuite, { headSha, repoFullName }) {
  const problems = []
  for (const run of passedRuns) {
    const workflowRun = workflowRunsBySuite.get(run.check_suite?.id)
    if (!workflowRun) problems.push(`${run.name}: no workflow run`)
    else if (!ALLOWED_CHECK_WORKFLOWS.includes(workflowRun.path)) problems.push(`${run.name}: from ${workflowRun.path}`)
    else if (workflowRun.head_sha !== headSha) problems.push(`${run.name}: other commit`)
    else if (workflowRun.head_repository?.full_name !== repoFullName) problems.push(`${run.name}: other repository`)
    else if (workflowRun.event !== "pull_request") problems.push(`${run.name}: ${workflowRun.event} run`)
  }
  return problems
}

// Returns { merge: true } or { merge: false, reason, final } where `final`
// means the label should be removed (the PR will not qualify as is).
function evaluate({ pr, repoFullName, files, requiredChecks, checkRuns, issueEvents, comments, allowedLabelers }) {
  const labels = (pr.labels || []).map((label) => label.name)
  if (!labels.includes(MERGE_LABEL)) return { merge: false, reason: "not labelled" }
  if (pr.state !== "open") return { merge: false, reason: "not open" }
  if (pr.draft) return { merge: false, reason: "draft" }
  if (pr.base?.ref !== "main") return { merge: false, reason: "base is not main", final: true }
  if (pr.head?.repo?.full_name !== repoFullName) return { merge: false, reason: "fork PR", final: true }
  const blocking = labels.filter((name) => BLOCKING_LABELS.includes(name))
  if (blocking.length) return { merge: false, reason: `carries ${blocking.join(", ")}`, final: true }
  const labeler = lastLabeler(issueEvents)
  if (!labeler || !allowedLabelers.includes(labeler)) {
    return { merge: false, reason: `label applied by ${labeler || "unknown"}, not an allowed account`, final: true }
  }
  const approval = latestApproval(comments)
  if (!approval || approval.sha !== pr.head.sha || !allowedLabelers.includes(approval.by)) {
    return { merge: false, reason: "no approval recorded at the current head commit; re-apply the label", final: true }
  }
  const touched = protectedFiles(files)
  if (touched.length) {
    return { merge: false, reason: `touches owner-merge paths: ${touched.slice(0, 5).join(", ")}`, final: true }
  }
  if (!requiredChecks.length) return { merge: false, reason: "no required checks found on main; refusing" }
  const checks = requiredChecksStatus(requiredChecks, checkRuns)
  if (checks.failed.length) return { merge: false, reason: `required checks failed: ${checks.failed.join(", ")}` }
  if (!checks.ok) {
    return { merge: false, reason: `waiting on ${[...checks.pending, ...checks.missing].join(", ")}` }
  }
  if (pr.mergeable === false || pr.mergeable_state === "dirty") return { merge: false, reason: "merge conflict" }
  if (pr.mergeable == null) return { merge: false, reason: "mergeability not computed yet" }
  return { merge: true, passed: checks.passed }
}

function code(text) {
  return "`" + String(text).replace(/`/g, "'") + "`"
}

async function run({ github, context, core, getOctokit }) {
  const { owner, repo } = context.repo
  const repoFullName = `${owner}/${repo}`
  const allowedLabelers = (process.env.MERGE_BOT_ALLOWED_LABELERS || owner)
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  // Approval comments are always written with the workflow's own token so
  // their author is github-actions[bot], which no person or agent can post as.
  const actions = getOctokit(process.env.ACTIONS_TOKEN)

  // Record or revoke approval on the triggering PR event.
  if (context.eventName === "pull_request_target") {
    const pr = context.payload.pull_request
    const action = context.payload.action
    const sender = context.payload.sender?.login
    const labelled = (pr.labels || []).some((label) => label.name === MERGE_LABEL)
    if (action === "labeled" && context.payload.label?.name === MERGE_LABEL) {
      if (allowedLabelers.includes(sender)) {
        await actions.rest.issues.createComment({
          owner,
          repo,
          issue_number: pr.number,
          body: `Merge bot: approved at ${code(pr.head.sha.slice(0, 8))} by ${code(sender)}. Merges when the required checks pass on this commit; any new push cancels it.\n<!-- merge-bot-approved:${pr.head.sha} by:${sender} -->`,
        })
      }
    } else if (action === "synchronize" && labelled) {
      await actions.rest.issues.removeLabel({ owner, repo, issue_number: pr.number, name: MERGE_LABEL }).catch(() => {})
      await actions.rest.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: `Merge bot: new commits after approval, so the ${code(MERGE_LABEL)} label was removed. Re-apply it to approve the new head.`,
      })
      return
    }
  }

  const rules = await github.request("GET /repos/{owner}/{repo}/rules/branches/{branch}", { owner, repo, branch: "main" })
  const requiredChecks = rules.data
    .filter((rule) => rule.type === "required_status_checks")
    .flatMap((rule) => rule.parameters.required_status_checks)

  const candidates = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: "open",
    labels: MERGE_LABEL,
    per_page: 100,
  })

  for (const issue of candidates) {
    if (!issue.pull_request) continue
    const number = issue.number
    const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number })
    const [files, checkRuns, issueEvents, comments] = await Promise.all([
      github.paginate(github.rest.pulls.listFiles, { owner, repo, pull_number: number, per_page: 100 }),
      github.paginate(github.rest.checks.listForRef, { owner, repo, ref: pr.head.sha, per_page: 100 }),
      github.paginate(github.rest.issues.listEvents, { owner, repo, issue_number: number, per_page: 100 }),
      github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: number, per_page: 100 }),
    ])

    let decision = evaluate({ pr, repoFullName, files, requiredChecks, checkRuns, issueEvents, comments, allowedLabelers })

    if (decision.merge) {
      const workflowRunsBySuite = new Map()
      for (const suiteId of new Set(decision.passed.map((checkRun) => checkRun.check_suite?.id).filter(Boolean))) {
        const { data } = await github.request("GET /repos/{owner}/{repo}/actions/runs", {
          owner,
          repo,
          check_suite_id: suiteId,
          per_page: 1,
        })
        if (data.workflow_runs?.[0]) workflowRunsBySuite.set(suiteId, data.workflow_runs[0])
      }
      const problems = checkProvenanceProblems(decision.passed, workflowRunsBySuite, { headSha: pr.head.sha, repoFullName })
      if (problems.length) decision = { merge: false, reason: `check provenance: ${problems.join("; ")}`, final: true }
    }

    if (!decision.merge) {
      core.info(`#${number}: skip (${decision.reason})`)
      if (decision.final) {
        await actions.rest.issues.removeLabel({ owner, repo, issue_number: number, name: MERGE_LABEL }).catch(() => {})
        await actions.rest.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: `Merge bot: not merging (${code(decision.reason)}). Label removed.`,
        })
      }
      continue
    }

    // Re-check the label right before merging, in case it was removed mid-run.
    const { data: fresh } = await github.rest.issues.listLabelsOnIssue({ owner, repo, issue_number: number })
    if (!fresh.some((label) => label.name === MERGE_LABEL)) {
      core.info(`#${number}: label removed during run`)
      continue
    }

    try {
      await github.rest.pulls.merge({ owner, repo, pull_number: number, sha: pr.head.sha, merge_method: "merge" })
      core.info(`#${number}: merged at ${pr.head.sha}`)
      await actions.rest.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: `Merge bot: merged at ${code(pr.head.sha.slice(0, 8))} after the ${requiredChecks.length} required checks passed.`,
      })
    } catch (error) {
      core.warning(`#${number}: merge failed: ${error.message}`)
    }
  }
}

module.exports = {
  run,
  evaluate,
  protectedFiles,
  requiredChecksStatus,
  lastLabeler,
  latestApproval,
  checkProvenanceProblems,
  MERGE_LABEL,
}
