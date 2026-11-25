'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

// "1 questions", "Assign to 1 members", "1 members selected", "1 clubs" and "of 1 applicants" each showed a plural
// beside a count of one. These labels go through pluralize so one reads as singular.
const cases = [
  ['components/interview-kit-editor.tsx', /pluralize\(questions\.length, "question"\)/, /`\$\{questions\.length\} questions`/],
  ['components/ranked-review-list.tsx', /of \{ordered\.length\} \{plural\(ordered\.length, "applicant"\)\}/, /\{ordered\.length\} applicants/],
  ['components/tasks/task-assignment-builder.tsx', /Assign to \$\{pluralize\(recipients\.length, "member"\)\}/, /\$\{recipients\.length\} members/],
  ['components/tasks/task-audience-builder.tsx', /\{pluralize\(selected\.length, "member"\)\} selected/, /\{selected\.length\} members selected/],
  ['components/views/explore-view.tsx', /Applications open · \{pluralize\(available\.length, "club"\)\}/, /\{available\.length\} clubs/],
]
for (const [file, want, gone] of cases) test(`count label is pluralized: ${file}`, () => {
  const src = read(file)
  assert.match(src, want); assert.doesNotMatch(src, gone)
  assert.match(src, /import \{[^}]*\b(pluralize|plural)\b[^}]*\} from "@\/lib\/copy\/terms"/)
})
