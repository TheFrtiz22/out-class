const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
function load(file, dependencies = {}) {
  const filename = path.resolve(__dirname, "..", file)
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mod = new Module(filename, module)
  mod.require = (name) => dependencies[name] || require(name)
  mod._compile(output, filename)
  return mod.exports
}
const { filterDirectory, emptyDirectoryFilters, recruitmentStage } = load("lib/club-directory.ts")
const clubs = [
  {
    id: "a",
    name: "Alpha Consulting",
    category: "Consulting",
    pitch: "Social impact projects",
    tags: ["Research"],
    acceptanceRate: 42,
    aumValue: null,
    timeCommitment: null,
  },
  {
    id: "b",
    name: "Beta Fund",
    category: "Finance",
    pitch: "Investing together",
    tags: [],
    acceptanceRate: null,
    aumValue: 100000,
    timeCommitment: "3-5",
  },
  {
    id: "c",
    name: "Gamma Fund",
    category: "Finance",
    pitch: "Research and capital",
    tags: [],
    acceptanceRate: 5,
    aumValue: 300000,
    timeCommitment: "5+",
  },
]
test("default discovery includes clubs above 25% and unknown acceptance, without fabricated rankings", () => {
  assert.deepEqual(
    filterDirectory(clubs, emptyDirectoryFilters).map((c) => c.id),
    ["a", "b", "c"],
  )
})
test("search matches words across real name, description, interests, and category fields", () => {
  assert.deepEqual(
    filterDirectory(clubs, { ...emptyDirectoryFilters, query: "  RESEARCH consulting " }).map(
      (c) => c.id,
    ),
    ["a"],
  )
})
test("filters combine and unknown facts do not satisfy a numerical filter", () => {
  assert.deepEqual(
    filterDirectory(clubs, {
      ...emptyDirectoryFilters,
      category: "Finance",
      aum: "medium",
      time: "3-5",
    }).map((c) => c.id),
    ["b"],
  )
  assert.deepEqual(
    filterDirectory(clubs, { ...emptyDirectoryFilters, acceptance: "25" }).map((c) => c.id),
    ["c"],
  )
})
test("timeline does not mark drafts or unknown custom stages as submitted", () => {
  for (const status of ["Drafting", "DRAFTING", "Custom round"])
    assert.equal(recruitmentStage(status), -1)
  assert.equal(recruitmentStage("SUBMITTED"), 0)
  assert.equal(recruitmentStage("IN_REVIEW"), 1)
  assert.equal(recruitmentStage("1st Round Interview"), 2)
  assert.equal(recruitmentStage("ACCEPTED"), 3)
})
test("public directory selects explicit public fields and preserves missing facts", async () => {
  let query
  const actions = load("actions/club-directory.ts", {
    "@/utils/prisma": {
      prisma: {
        club: {
          findMany: async (q) => {
            query = q
            return [
              {
                id: "a",
                name: "A Club",
                tagline: "Hello",
                description: "About",
                logoUrl: null,
                category: "Finance",
                color: "#142d4e",
                acceptanceRate: null,
                aumValue: null,
                pipelineRounds: [],
                questions: [],
                events: [],
              },
            ]
          },
        },
      },
    },
  })
  const result = await actions.getClubDirectory()
  assert.equal(result.clubs[0].acceptanceRate, null)
  assert.equal(result.clubs[0].timeCommitment, null)
  assert.equal(result.clubs[0].applicationAvailable, false)
  for (const key of ["members", "applications", "evaluations"])
    assert.equal(query.select[key], undefined)
  assert.equal(query.select.events.where.isPublic, true)
})
test("starting an existing application never updates or deletes its answers", async () => {
  let writes = 0
  const actions = load("actions/club-directory.ts", {
    "@/utils/auth": { requireAuth: async () => ({ user: { id: "student" } }) },
    "@/utils/prisma": {
      prisma: {
        application: {
          findUnique: async () => ({ id: "existing" }),
          upsert: async () => {
            writes++
          },
        },
      },
    },
  })
  assert.deepEqual(await actions.startClubApplication("club"), { applicationId: "existing" })
  assert.equal(writes, 0)
})
test("concurrent starts use an empty update branch and session-derived identity", async () => {
  let args
  const actions = load("actions/club-directory.ts", {
    "@/utils/auth": { requireAuth: async () => ({ user: { id: "session-user" } }) },
    "@/utils/prisma": {
      prisma: {
        application: {
          findUnique: async () => null,
          upsert: async (q) => {
            args = q
            return { id: "created" }
          },
        },
        pipelineRound: { findFirst: async () => ({ id: "first" }) },
      },
    },
  })
  await actions.startClubApplication("club")
  assert.deepEqual(args.update, {})
  assert.equal(args.create.studentId, "session-user")
  assert.equal(args.create.status, "DRAFTING")
  assert.equal(args.create.answers, undefined)
})
