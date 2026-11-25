const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/applications/application-form.tsx"), "utf8")

test("a multiple-choice hint only mentions missing choices when there are none", () => {
  assert.doesNotMatch(src, /Select one option\. If no choices are listed/)
  assert.match(src, /question\.type === "MULTIPLE_CHOICE" \? question\.options\?\.length \? "Select one option\." : "This question has no choices yet\./)
})
