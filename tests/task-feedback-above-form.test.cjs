const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../components/club-tasks.tsx"), "utf8");

test("a reviewer's feedback appears above the submission fields, where the member starts reading", () => {
  const feedback = source.indexOf('"Revisions requested"');
  const firstField = source.indexOf("Written response <small>");
  const submit = source.indexOf('"Resubmit revisions"');
  assert.ok(feedback > 0 && firstField > 0 && submit > 0);
  assert.ok(feedback < firstField, "feedback should come before the written response field");
  assert.ok(feedback < submit);
});
