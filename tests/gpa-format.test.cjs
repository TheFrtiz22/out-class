const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
const { loadComponent } = require("./helpers/component-module.cjs")

test("GPAs read with two to three decimals", () => {
  const { formatGpa } = loadComponent("lib/student-profile.ts")
  assert.equal(formatGpa(4), "4.00")
  assert.equal(formatGpa(3.7), "3.70")
  assert.equal(formatGpa(3.91), "3.91")
  assert.equal(formatGpa(3.875), "3.875")
})

test("the leader's applicant facts show a whole-number GPA as 4.00", () => {
  const { ApplicantProfileFacts } = loadComponent("components/views/leader-dashboard/applicant-profile-facts.tsx")
  const html = renderToStaticMarkup(React.createElement(ApplicantProfileFacts, { profile: { academicYear: "Third Year", gpa: 4 }, fields: { gpa: true, academicYear: true } }))
  assert.match(html, /GPA 4\.00/)
})

test("the student's own profile shows a whole-number GPA as 4.00 / 4.00", () => {
  const src = fs.readFileSync("components/views/unified-student-profile-view.tsx", "utf8")
  assert.match(src, /`\$\{formatGpa\(profile\.gpa\)\} \/ 4\.00`/)
})
