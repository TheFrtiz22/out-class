const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { ESLint } = require("eslint")

// Ratchet for outclass/no-raw-colors: baselined files may only lose violations.
test("baselined files do not gain raw color violations", async () => {
  const baseline = JSON.parse(fs.readFileSync("eslint-rules/no-raw-colors-baseline.json", "utf8"))
  const files = Object.keys(baseline).filter(file => fs.existsSync(file))
  const eslint = new ESLint({ ruleFilter: ({ ruleId }) => ruleId === "outclass/no-raw-colors" })
  const results = await eslint.lintFiles(files)
  const grown = []
  for (const result of results) {
    const file = result.filePath.replace(`${process.cwd()}/`, "")
    const count = result.messages.filter(message => message.ruleId === "outclass/no-raw-colors").length
    if (count > baseline[file]) grown.push(`${file}: ${baseline[file]} -> ${count}`)
  }
  assert.deepEqual(grown, [], "use OutClass tokens instead of new neutral ramps or hex colors")
})
