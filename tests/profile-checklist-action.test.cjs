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
  assert.match(src, /const editDialog = \(trigger: ReactNode, section\?: ProfileSection, onOpenChange\?: \(open: boolean\) => void\) => <EditStudentProfileDialog/)
  assert.match(src, /const editProfile = editDialog\(/)
})

test("each checklist item maps to the editor section where it is filled in", () => {
  for (const label of ["Name", "Education", "Résumé", "Experience", "LinkedIn"]) assert.match(src, new RegExp(`"?${label}"?: "(identity|education|links|experience)"`), label)
})

test("autosave in the checklist editor doesn't close it", () => {
  const dialog = src.slice(src.indexOf("const editDialog ="), src.indexOf("const editProfile ="))
  assert.doesNotMatch(dialog, /<EditStudentProfileDialog\s+key=/, "a key that follows the first missing item remounts the open editor after each autosave")
  assert.match(src, /const showChecklist = !allAdded \|\| checklistEditing/)
  assert.match(src, /\{showChecklist && <Panel as="aside">/)
  assert.match(src, /, setChecklistEditing\)\}/)
  const editor = fs.readFileSync(path.join(__dirname, "..", "components/edit-student-profile-dialog.tsx"), "utf8")
  // Every way the editor closes (Cancel, Escape, overlay and Save) tells the parent, or the checklist stays up reading "5 of 5".
  assert.equal(editor.match(/setOpen\(false\)/g).length, editor.match(/setOpen\(false\); onOpenChange\?\.\(false\)/g).length)
  assert.match(editor, /setOpen\(value\)\n    onOpenChange\?\.\(true\)/)
  // The dialog picks up the section each time it opens.
  assert.match(editor, /if \(value\) setSection\(initialSection\)/)
})
