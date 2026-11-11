const { test } = require("node:test")
const assert = require("node:assert/strict")
const { ESLint } = require("eslint")

// The baseline is gone: outclass/no-raw-colors is an error everywhere, and no .tsx file has a violation.
test("no .tsx file uses raw neutral ramps or hex colors; the rule is an error with no exceptions", async () => {
  const eslint = new ESLint({ ruleFilter: ({ ruleId }) => ruleId === "outclass/no-raw-colors" })
  const results = await eslint.lintFiles(["app/**/*.tsx", "components/**/*.tsx", "lib/**/*.tsx", "contexts/**/*.tsx"])
  const found = results.flatMap(result => result.messages.filter(message => message.ruleId === "outclass/no-raw-colors").map(message => `${result.filePath.replace(`${process.cwd()}/`, "")}:${message.line} ${message.message}`))
  assert.deepEqual(found, [])
  const config = await eslint.calculateConfigForFile("components/views/leader-dashboard-view.tsx")
  assert.equal(config.rules["outclass/no-raw-colors"][0], 2, "error, not warn")
})
