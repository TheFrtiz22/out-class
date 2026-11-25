const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const read = file => fs.readFileSync(file, "utf8")

test("applicant score and feedback name reviewers by number, never by account id", () => {
  for (const file of ["lib/applicant-display.ts", "actions/applicant-intelligence.ts", "lib/demo/workspace.ts"]) {
    assert.doesNotMatch(read(file), /Reviewer \$\{[a-z]+\.interviewerId\}/, `${file} must not print a raw reviewer id`)
  }
  const display = read("lib/applicant-display.ts")
  assert.match(display, /export function reviewerLabel\(/)
  assert.match(display, /\$\{reviewerLabel\(safe\.evaluations\)\(e\.interviewerId\)\}/)
  assert.match(read("actions/applicant-intelligence.ts"), /\$\{reviewerLabel\(app\.evaluations\)\(final\.interviewerId\)\}/)
})

test("reviewer numbering is stable by first appearance", () => {
  // Same logic as reviewerLabel, checked without loading the TypeScript module.
  const src = read("lib/applicant-display.ts")
  const body = src.slice(src.indexOf("export function reviewerLabel"), src.indexOf("/** Call only after authorizing"))
  assert.match(body, /\[\.\.\.new Set\(evaluations\.map\(e => e\.interviewerId\)\)\]/)
  assert.match(body, /`Reviewer \$\{n \+ 1\}`/)
})
