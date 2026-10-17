const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
function load(file, dependencies = {}) {
  dependencies = { "next/cache": { unstable_cache: fn => fn }, ...dependencies }
  if (dependencies["@/utils/prisma"]?.prisma) { const db=dependencies["@/utils/prisma"].prisma; db.$queryRaw ||= async()=>[]; db.$transaction ||= async fn=>fn(db); db.club ||= {}; db.club.findUnique ||= async()=>({applicationOpen:true}); }
  const filename = path.resolve(__dirname, "..", file)
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mod = new Module(filename, module)
  mod.require = (name) => dependencies[name] || (name.startsWith("@/lib/") ? load(name.slice(2)+".ts",dependencies) : require(name))
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
  let query, eventQuery
  const actions = load("actions/club-directory.ts", {
    "@/utils/prisma": {
      prisma: {
        meeting: { findMany: async q => { eventQuery=q; return [] } },
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
  assert.equal(query.select.events, false)
  assert.equal(eventQuery.where.isPublic, true)
  assert.ok(eventQuery.where.OR.some(condition => condition.publication.is?.status === "PUBLISHED"))
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

test('category URL filters are case-insensitive without introducing a second directory',()=>{
 assert.deepEqual(filterDirectory(clubs,{...emptyDirectoryFilters,category:'consulting'}).map(c=>c.id),['a']);
});

test('cached public directory deadlines survive JSON serialization and retain availability', async () => {
  const deadline = new Date(Date.now() + 86400000)
  const record = { id: 'cached-club', name: 'Cached society', claimedAt: new Date(), suspendedAt: null, applicationOpen: true,
    applicationDeadline: deadline, tagline: 'Research', description: 'Public profile', color: '#142d4e', category: 'Academic',
    logoUrl: null, bannerUrl: null, marketing: {}, acceptanceRate: null, aumValue: null, testRequirement: 'OPTIONAL', campusKey: 'uva', directorySource: null,
    pipelineRounds: [{ id: 'review', name: 'Application review', order: 0 }], questions: [] }
  let reads = 0
  const api = load('actions/club-directory.ts', {
    'next/cache': { unstable_cache: fn => { let saved; return async () => { if (!saved) saved = JSON.stringify(await fn()); return JSON.parse(saved) } } },
    '@/utils/prisma': { prisma: { club: { findMany: async () => { reads++; return [record] } }, meeting: { findMany: async () => [] } } },
  })
  for (let i = 0; i < 2; i++) {
    const result = await api.getClubDirectory()
    assert.equal(result.error, undefined)
    assert.equal(result.clubs[0].applicationDeadline, deadline.toISOString())
    assert.equal(result.clubs[0].applicationAvailable, true)
  }
  assert.equal(reads, 1)
})


test("legacy fund-size parameters are ignored and removed without losing other filters or public AUM", () => {
  const { directoryFiltersFromParams, directoryFilterParams } = load("lib/club-directory.ts")
  const params = new URLSearchParams("aum=large&category=Finance&q=fund&time=3-5&eventId=event")
  const filters = directoryFiltersFromParams(params)
  assert.equal("aum" in filters, false)
  assert.deepEqual(filterDirectory(clubs, filters).map(c => c.id), ["b"])
  const cleaned = directoryFilterParams(params, filters)
  assert.equal(cleaned.has("aum"), false)
  for (const key of ["q", "category", "time", "eventId"]) assert.equal(cleaned.get(key), params.get(key))
  assert.equal(clubs[1].aumValue, 100000)
})

test('employer search matches only explicitly recorded destinations and combines with category filters', () => {
  const listed = clubs.map(c => ({ ...c, marketing: { placements: c.id === 'b' ? ['Morgan Stanley'] : [] } }))
  assert.deepEqual(filterDirectory(listed, { ...emptyDirectoryFilters, query: 'Morgan Stanley' }).map(c => c.id), ['b'])
  assert.equal(filterDirectory(listed, { ...emptyDirectoryFilters, query: 'Morgan Stanley', category: 'Consulting' }).length, 0)
  assert.equal(filterDirectory(listed, { ...emptyDirectoryFilters, query: 'Invented Employer' }).length, 0)
})

test('open and not-open filters partition the full directory without hiding clubs with unpublished recruitment', () => {
  const now = Date.parse('2026-10-17T00:00:00Z')
  const fixtures = clubs.map((c, i) => ({ ...c, applicationAvailable: i !== 2, applicationDeadline: i === 1 ? '2026-10-16T00:00:00Z' : null }))
  const open = filterDirectory(fixtures, { ...emptyDirectoryFilters, recruitment: 'open' }, now)
  const closed = filterDirectory(fixtures, { ...emptyDirectoryFilters, recruitment: 'closed' }, now)
  assert.deepEqual(open.map(c => c.id), ['a'])
  assert.deepEqual(closed.map(c => c.id), ['b', 'c'])
  assert.equal(open.length + closed.length, fixtures.length)
  const { directoryFiltersFromParams, directoryFilterParams } = load('lib/club-directory.ts')
  const saved = directoryFilterParams(new URLSearchParams(), { ...emptyDirectoryFilters, recruitment: 'closed' })
  assert.equal(directoryFiltersFromParams(saved).recruitment, 'closed')
  assert.equal(directoryFiltersFromParams(new URLSearchParams('recruitment=invalid')).recruitment, 'all')
})
