const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const grading = fs.readFileSync("components/applicant-review/review-grading.tsx", "utf8")

test("an owner offered Assign me is told to assign themselves, not sent to Interviews › Scheduling", () => {
  const branch = grading.slice(grading.indexOf("{!canEvaluate && (onAssignSelf && !submittedHere"), grading.indexOf('"Assign me"'))
  assert.match(branch, /data-assign-self-hint>You’re not on this applicant’s panel yet\. Assign yourself to grade them\.</)
  assert.doesNotMatch(branch, /\{reason\}/, "the generic panel reason is for members who can't assign themselves")
  // Members without the grant still get the reason that explains who assigns panels.
  assert.match(grading, /: <p className="text-xs text-muted-foreground">\{reason\}<\/p>\)\}/)
  // After submitting from this panel the member is on it, so they see the read-only reason, not Assign me.
  assert.match(grading, /setMessage\("Grade submitted\."\)\n\s*setSubmittedHere\(true\)/)
})
