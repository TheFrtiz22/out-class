// Interview schedule (Nov 18 2026 visual check): a draft made only of past dates, or one whose
// availability changed, must not present "Confirm assignments" as the next step.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const preview = fs.readFileSync("components/interviews/panel-preview-workspace.tsx", "utf8")

test("Confirm assignments steps back while a recheck or new times are needed", () => {
  assert.match(preview, /const confirmVariant = needsRecheck \|\| onlyPastDays \? "outline" : "default"/)
  assert.match(preview, /<Button variant=\{confirmVariant\} disabled=\{busy\} onClick=\{finalize\}>Confirm assignments<\/Button>/)
  // The recheck itself becomes the primary action, and Confirm stays enabled (the server still enforces the recheck).
  assert.match(preview, /variant=\{needsRecheck \? "default" : "link"\}[^>]*onClick=\{\(\) => void revalidate\(\)\}/)
})

test("past dates are marked, and a past-only draft points to Set interview times", () => {
  assert.match(preview, /const todayKey = dayKey\(new Date\(\), SCHEDULING_TIMEZONE\)/)
  assert.match(preview, /scheduleSessions\.every\(s => dayKey\(s\.startTime, SCHEDULING_TIMEZONE\) < todayKey\)/)
  assert.match(preview, /Every slot in this draft is on a past date\. Set new interview times, then assign interviewers\./)
  assert.match(preview, /\{day < todayKey \? "Past · " : ""\}/)
  // Unfilled counts for past days are noise: nobody can interview on them.
  assert.match(preview, /\{day < todayKey \? "" : unfilled > 0 \?/)
  // Day keys are YYYY-MM-DD, so string order is date order.
  assert.ok("2026-10-15" < "2026-11-18" && "2026-11-18" < "2026-12-01")
})
