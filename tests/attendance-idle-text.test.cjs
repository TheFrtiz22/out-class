const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../components/meeting-workspace.tsx"), "utf8");

test("a meeting row shows only the Check attendance button before attendance is opened", () => {
  assert.doesNotMatch(source, /Attendance not loaded/);
  assert.match(source, /opened \? "Loading attendance…" : ""/);
  assert.match(source, /"Check attendance"/);
});
