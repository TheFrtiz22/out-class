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
  mod.require = (name) => name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name)
  mod._compile(output, filename)
  return mod.exports
}
const { suggestClubs, majorInterests } = load("lib/club-suggestions.ts")
const club = (id, name, category, tags = [], extra = {}) => ({ id, name, category, tags, pitch: "", acceptanceRate: null, aumValue: null, timeCommitment: null, logoText: "", color: "", ...extra })
const survey = (patch = {}) => ({ interests: [], goals: [], weeklyHours: null, selectivity: null, ...patch })
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

test("cold start: survey answers alone rank matching clubs first, with the chip named as the reason", () => {
  const result = suggestClubs(directory, { saved: [], survey: survey({ interests: ["consulting"] }) })
  assert.deepEqual(result.slice(0, 3).map(s => s.club.id).sort(), ["impact", "tcg", "vcg"])
  assert.equal(result[0].reason, "Because you picked Consulting")
  assert.ok(!result.some(s => ["acap", "hack", "mii"].includes(s.club.id)), "unrelated clubs are never padded in")
  const goal = suggestClubs(directory, { saved: [], survey: survey({ goals: ["creative"] }) })
  assert.deepEqual(goal.map(s => s.club.id), ["acap"])
  assert.equal(goal[0].reason, "Because you want a creative outlet")
  assert.deepEqual(suggestClubs(directory, { saved: [], survey: survey({ weeklyHours: "3-5", selectivity: "yes" }) }), [], "time and selectivity never add clubs on their own")
})

test("a saved club still dominates the survey, and the survey outweighs the major", () => {
  const result = suggestClubs(directory, { saved: [directory[0]], survey: survey({ interests: ["arts", "tech"], goals: ["creative", "competition"] }) })
  assert.equal(result[0].club.id, "tcg", "same category as a saved club beats two chips and two goals")
  assert.equal(result[0].reason, "Similar to Virginia Consulting Group")
  const major = suggestClubs(directory, { saved: [], major: "Computer Science", survey: survey({ interests: ["arts"] }) })
  assert.equal(major[0].club.id, "acap")
  assert.equal(major[0].reason, "Because you picked Arts & performance")
  assert.equal(major[1].club.id, "hack")
})

test("Social matches only the Social category, not every category containing the word", () => {
  const clubs = [club("s", "Hoos Social", "Social"), club("i", "Impact Club", "Impact & Social Enterprise")]
  assert.deepEqual(suggestClubs(clubs, { saved: [], survey: survey({ interests: ["social"] }) }).map(s => s.club.id), ["s"])
})

test("time and selectivity only re-order matches, and only when the directory publishes the field", () => {
  const clubs = [
    club("a", "Alpha Consulting", "Consulting", [], { acceptanceRate: 8, timeCommitment: "5+" }),
    club("b", "Beta Consulting", "Consulting", [], { acceptanceRate: 60, timeCommitment: "1-3" }),
    club("c", "Gamma Consulting", "Consulting"),
  ]
  const base = suggestClubs(clubs, { saved: [], survey: survey({ interests: ["consulting"] }) })
  assert.deepEqual(base.map(s => s.club.id), ["a", "b", "c"], "ties fall back to name order")
  const notSelective = suggestClubs(clubs, { saved: [], survey: survey({ interests: ["consulting"], selectivity: "no", weeklyHours: "1-2" }) })
  assert.deepEqual(notSelective.map(s => s.club.id), ["b", "c", "a"], "a selective club drops but stays listed")
  assert.equal(suggestClubs(clubs, { saved: [], survey: survey({ interests: ["consulting"], selectivity: "either" }) }).map(s => s.score).join(), base.map(s => s.score).join())
})

test("suggestions are deterministic", () => {
  const input = { saved: [directory[3]], major: "Commerce", survey: survey({ interests: ["consulting", "tech"], goals: ["career"] }) }
  assert.deepEqual(suggestClubs(directory, input), suggestClubs(directory, input))
})
