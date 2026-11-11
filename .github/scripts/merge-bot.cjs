"use strict"

// Merge bot: merges a pull request into main once the owner's account has
// labelled it `merge-when-green` and every check required by the main
// ruleset has passed on the PR's current head commit. Merges with the head
// SHA pinned, so a push after the checks ran makes the merge fail instead of
// shipping unchecked code.
//
// It never merges a PR that touches the database schema or migrations,
// GitHub workflows, agent guardrails or Supabase config, that carries
// "Apply before merge" or "do-not-merge", that is a draft, or that comes
// from a fork. Those stay the owner's to merge by hand.

const MERGE_LABEL = "merge-when-green"
const BLOCKING_LABELS = ["Apply before merge", "do-not-merge"]
const PROTECTED_PATHS = [
  /^prisma\//,
  /^supabase\//,
  /^\.github\//,
  /^\.claude\//,
  /^vercel\.json$/,
  /^middleware\.ts$/,
]

function protectedFiles(filenames) {
  return filenames.filter((name) => PROTECTED_PATHS.some((pattern) => pattern.test(name)))
}

// Latest check run per name wins (re-runs replace earlier attempts).
function latestRunsByName(checkRuns) {
  const latest = new Map()
  for (const run of checkRuns) {
    const previous = latest.get(run.name)
    const started = Date.parse(run.started_at || 0)
    if (!previous || started >= Date.parse(previous.started_at || 0)) latest.set(run.name, run)
  }
  return latest
}

function requiredChecksStatus(requiredContexts, checkRuns) {
  const latest = latestRunsByName(checkRuns)
  const missing = []
  const pending = []
  const failed = []
  for (const context of requiredContexts) {
    const run = latest.get(context)
    if (!run) missing.push(context)
    else if (run.status !== "completed") pending.push(context)
    else if (run.conclusion !== "success") failed.push(`${context} (${run.conclusion})`)
  }
  return { ok: !missing.length && !pending.length && !failed.length, missing, pending, failed }
}

// Who last applied the merge label. The bot only acts on labels applied by an
// allowlisted account.
function lastLabeler(issueEvents, label = MERGE_LABEL) {
  let actor = null
  for (const event of issueEvents) {
    if (event.label?.name !== label) continue
    if (event.event === "labeled") actor = event.actor?.login ?? null
    if (event.event === "unlabeled") actor = null
  }
  return actor
}

// Returns { merge: true } or { merge: false, reason, final } where `final`
// means the label should be removed (the PR will never qualify as is).
function evaluate({ pr, repoFullName, filenames, requiredContexts, checkRuns, issueEvents, allowedLabelers }) {
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
  const touched = protectedFiles(filenames)
  if (touched.length) {
    return { merge: false, reason: `touches owner-merge paths: ${touched.slice(0, 5).join(", ")}`, final: true }
  }
  if (!requiredContexts.length) return { merge: false, reason: "no required checks found on main; refusing" }
  const checks = requiredChecksStatus(requiredContexts, checkRuns)
  if (checks.failed.length) return { merge: false, reason: `required checks failed: ${checks.failed.join(", ")}` }
  if (!checks.ok) {
    return { merge: false, reason: `waiting on ${[...checks.pending, ...checks.missing].join(", ")}` }
  }
  if (pr.mergeable === false || pr.mergeable_state === "dirty") return { merge: false, reason: "merge conflict" }
  if (pr.mergeable == null) return { merge: false, reason: "mergeability not computed yet" }
  return { merge: true }
}

async function run({ github, context, core }) {
  const { owner, repo } = context.repo
  const repoFullName = `${owner}/${repo}`
  const allowedLabelers = (process.env.MERGE_BOT_ALLOWED_LABELERS || owner)
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  const rules = await github.request("GET /repos/{owner}/{repo}/rules/branches/{branch}", { owner, repo, branch: "main" })
  const requiredContexts = rules.data
    .filter((rule) => rule.type === "required_status_checks")
    .flatMap((rule) => rule.parameters.required_status_checks.map((check) => check.context))

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
    const files = await github.paginate(github.rest.pulls.listFiles, { owner, repo, pull_number: number, per_page: 100 })
    const checkRuns = await github.paginate(github.rest.checks.listForRef, {
      owner,
      repo,
      ref: pr.head.sha,
      per_page: 100,
    })
    const issueEvents = await github.paginate(github.rest.issues.listEvents, {
      owner,
      repo,
      issue_number: number,
      per_page: 100,
    })

    const decision = evaluate({
      pr,
      repoFullName,
      filenames: files.map((file) => file.filename),
      requiredContexts,
      checkRuns,
      issueEvents,
      allowedLabelers,
    })

    if (!decision.merge) {
      core.info(`#${number}: skip (${decision.reason})`)
      if (decision.final) {
        await github.rest.issues.removeLabel({ owner, repo, issue_number: number, name: MERGE_LABEL }).catch(() => {})
        await github.rest.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: `Merge bot: not merging (${decision.reason}). This one needs the owner to merge by hand. Label removed.`,
        })
      }
      continue
    }

    try {
      await github.rest.pulls.merge({ owner, repo, pull_number: number, sha: pr.head.sha, merge_method: "merge" })
      core.info(`#${number}: merged at ${pr.head.sha}`)
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: `Merge bot: merged at \`${pr.head.sha.slice(0, 8)}\` after the required checks passed (${requiredContexts.length}).`,
      })
    } catch (error) {
      core.warning(`#${number}: merge failed: ${error.message}`)
    }
  }
}

module.exports = { run, evaluate, protectedFiles, requiredChecksStatus, lastLabeler, MERGE_LABEL }
