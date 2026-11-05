const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { ESLint } = require("eslint")

// A true ratchet for outclass/no-raw-colors: each baselined file must report exactly its
// recorded count. More fails (new raw colors); fewer fails too, so fixes lower the baseline
// and a fixed violation can't be swapped for a new one. Deleted files must leave the baseline.
test("baselined files match their recorded raw-color counts exactly", async () => {
  const baseline = JSON.parse(fs.readFileSync("eslint-rules/no-raw-colors-baseline.json", "utf8"))
  const missing = Object.keys(baseline).filter(file => !fs.existsSync(file))
  assert.deepEqual(missing, [], "remove deleted or renamed files from eslint-rules/no-raw-colors-baseline.json")
  const eslint = new ESLint({ ruleFilter: ({ ruleId }) => ruleId === "outclass/no-raw-colors" })
  const counts = Object.fromEntries(Object.keys(baseline).map(file => [file, 0]))
  for (const result of await eslint.lintFiles(Object.keys(baseline))) {
    const file = result.filePath.replace(`${process.cwd()}/`, "")
    counts[file] = result.messages.filter(message => message.ruleId === "outclass/no-raw-colors").length
  }
  const drift = Object.entries(baseline).filter(([file, expected]) => counts[file] !== expected).map(([file, expected]) => `${file}: baseline ${expected}, now ${counts[file]}`)
  assert.deepEqual(drift, [], "new raw colors: use tokens. Fewer: lower the count in the baseline (remove the file at 0).")
  assert.ok(Object.values(baseline).every(count => count > 0), "a baseline entry of 0 should be removed")
})
