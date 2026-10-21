// Report which environment-gated suites have real disposable CI runners.
// A green report does NOT mean unconfigured suites ran. The remaining gap is explicit.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const expected = [
  "account-data-e2e", "admin-session-e2e", "admin-workspace-e2e",
  "availability-schedules-native", "campus-event-discovery-browser",
  "campus-event-discovery", "club-assets-e2e", "communication-schedules-e2e",
  "communication-schedules-native", "communications-e2e", "communications-native",
  "corkboard-e2e", "decision-communications-e2e", "decision-publication-e2e",
  "decision-publication-native", "decision-transactions-native",
  "event-storage-native", "interview-collaboration-native",
  "interview-native-concurrency", "invitation-schedules-e2e",
  "invitation-schedules-native", "onboarding-concurrency", "onboarding-e2e",
  "recipient-audiences-e2e", "recipient-audiences-native",
  "recruitment-native", "recruitment-offers-native", "resume-import-runtime",
  "scheduler-polling-native", "scheduler-release-native",
  "session-revocation-e2e", "settings-navigation-e2e", "signup-privacy-e2e",
  "student-claim-e2e",
];
const runners = {
  "scripts/run-onboarding-e2e.cjs": [
    "account-data-e2e", "onboarding-e2e", "resume-import-runtime",
    "session-revocation-e2e", "settings-navigation-e2e",
    "signup-privacy-e2e", "student-claim-e2e",
  ],
  "scripts/run-disposable-postgres.cjs": [
    "campus-event-discovery-browser", "campus-event-discovery",
    "interview-collaboration-native", "interview-native-concurrency",
    "onboarding-concurrency",
  ],
  "scripts/test-decision-publication-local.cjs": [
    "availability-schedules-native", "communication-schedules-native",
    "decision-publication-native", "invitation-schedules-native",
    "recipient-audiences-native",
  ],
  "scripts/test-decision-transactions-local.cjs": [
    "communications-native", "decision-transactions-native",
    "recruitment-native", "recruitment-offers-native",
  ],
  "scripts/test-scheduler-polling-local.cjs": [
    "scheduler-polling-native", "scheduler-release-native",
  ],
  "scripts/run-availability-e2e.cjs": [
    "event-storage-native",
  ],
};
const expectedSet = new Set(expected);
assert.equal(expected.length, 34, "The inventory must track all 34 environment-gated top-level suites");
assert.equal(expectedSet.size, expected.length, "Duplicate suite in the 34-test inventory");
const covered = new Set();
for (const [runner, suites] of Object.entries(runners)) {
  const source = fs.readFileSync(runner, "utf8");
  for (const name of suites) {
    assert(expectedSet.has(name), "Unexpected suite: " + name);
    assert(!covered.has(name), "Multiple runner claims for " + name);
    assert(source.includes("tests/" + name + ".test.cjs"),
      runner + " must explicitly invoke " + name + ".test.cjs");
    covered.add(name);
  }
}
for (const name of expected) {
  const testFile = path.join("tests", name + ".test.cjs");
  assert(fs.existsSync(testFile), "Missing gated suite: " + testFile);
}
const workflow = fs.readFileSync(".github/workflows/disposable-integrations.yml", "utf8");
for (const runner of Object.keys(runners))
  assert(workflow.includes(path.basename(runner)), "Missing CI runner: " + runner);
const pending = expected.filter(name => !covered.has(name));
const report = [
  "### Environment-gated integration suites",
  "",
  "- Inventory: **" + expected.length + "** top-level suites",
  "- Wired to disposable CI: **" + covered.size + "**",
  "- Still without automatic fixture: **" + pending.length + "**",
  "",
  "#### Unwired suites (still skipped in a plain pnpm test run)",
  "",
  ...pending.map(name => "- tests/" + name + ".test.cjs"),
  "",
  "The native fixtures are bounded local PostgreSQL; onboarding uses isolated Next.js, Supabase Auth and captured SMTP. Storage uses a separate local Supabase project. This static report verifies runner mappings, **not** test execution.",
].join("\n") + "\n";
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
