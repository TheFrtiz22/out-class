const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
function load(file) {
  const filename = path.resolve(__dirname, "..", file)
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = new Module(filename, module)
  mod.require = (name) => require(name)
  mod._compile(output, filename)
  return mod.exports
}
const { suggestClubs, majorInterests } = load("lib/club-suggestions.ts")
const club = (id, name, category, tags = []) => ({ id, name, category, tags, pitch: "", acceptanceRate: null, aumValue: null, timeCommitment: null, logoText: "", color: "" })
const directory = [
  club("vcg", "Virginia Consulting Group", "Consulting", ["Strategy"]),
  club("tcg", "The Consulting Group", "Consulting", ["Strategy"]),
  club("impact", "Impact Consulting", "Consulting & Impact Investing"),
  club("mii", "McIntire Investment Institute", "Finance", ["Investing"]),
  club("acap", "Hullabahoos", "Performing Arts", ["A cappella"]),
  club("hack", "HooHacks", "Technology", ["Software"]),
]

test("clubs in the same category as a saved club rank first, with the saved club named as the reason", () => {
  const result = suggestClubs(directory, { saved: [directory[0]] })
  assert.equal(result[0].club.id, "tcg")
  assert.equal(result[0].reason, "Similar to Virginia Consulting Group")
  assert.ok(result.some(s => s.club.id === "impact"), "a related category (shared word) still matches")
  assert.ok(!result.some(s => s.club.id === "acap"), "unrelated clubs are never padded in")
})

test("saved clubs and clubs the student already belongs to are excluded", () => {
  const result = suggestClubs(directory, { saved: [directory[0]], exclude: ["tcg"] })
  assert.ok(!result.some(s => ["vcg", "tcg"].includes(s.club.id)))
})

test("a major alone suggests matching interests and says why", () => {
  const result = suggestClubs(directory, { saved: [], major: "Computer Science" })
  assert.deepEqual(result.map(s => s.club.id), ["hack"])
  assert.equal(result[0].reason, "Fits your Computer Science major")
  assert.ok(majorInterests("Commerce").has("consulting"))
})

test("no saved clubs and no major means no suggestions, and the limit holds", () => {
  assert.deepEqual(suggestClubs(directory, { saved: [], major: "" }), [])
  assert.equal(suggestClubs(directory, { saved: [directory[0]], major: "Commerce" }, 2).length, 2)
})
