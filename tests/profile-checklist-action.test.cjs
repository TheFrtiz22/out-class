const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/views/unified-student-profile-view.tsx"), "utf8")

test("the profile details checklist ends with a button that opens Edit profile", () => {
  const panel = src.slice(src.indexOf('<h3 className="oc-card-heading ">Profile details</h3>'))
  const end = panel.indexOf("</Panel>}")
  const body = panel.slice(0, end)
  assert.match(body, /data-checklist-action>\{editDialog\(<Button[^>]*>[\s\S]*?Add missing details<\/Button>, checklistSection\[checklist\.find\(item => !item\.complete\)/)
})

test("the header button and the checklist button open the same edit dialog", () => {
  assert.match(src, /const editDialog = \(trigger: ReactNode, section\?: ProfileSection\) => <EditStudentProfileDialog/)
  assert.match(src, /const editProfile = editDialog\(/)
})

test("each checklist item maps to the editor section where it is filled in", () => {
  for (const label of ["Name", "Education", "Résumé", "Experience", "LinkedIn"]) assert.match(src, new RegExp(`"?${label}"?: "(identity|education|links|experience)"`), label)
})
