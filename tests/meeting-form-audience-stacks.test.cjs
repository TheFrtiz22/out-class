const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const src = fs.readFileSync("components/meeting-workspace.tsx", "utf8")
const editor = src.slice(src.indexOf("function MeetingEditor"))

// Live on a phone, New meeting showed Audience as the only field with its label beside a narrow, separately styled
// select; every other field stacks its label over a full-width control. The form also added its own top padding
// inside a sheet that already pads.
test("meeting editor's Audience select stacks under its label like the other fields", () => {
  const audience = editor.slice(editor.indexOf("Audience"), editor.indexOf('<option value="RECRUITMENT">'))
  assert.match(audience, /className="mt-1 w-full"/)
  assert.doesNotMatch(audience, /ml-3|rounded border p-2/)
})

test("meeting editor form adds no extra top padding inside its sheet", () => {
  const form = editor.slice(editor.indexOf("<form"), editor.indexOf("onInvalidCapture"))
  assert.match(form, /className="space-y-4"/)
  assert.doesNotMatch(form, /py-4/)
})
