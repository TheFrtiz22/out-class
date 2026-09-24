const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
function harness() {
  const cache = {}
  let calls = 0
  global.localStorage = {
    data: new Map(),
    getItem(k) {
      return this.data.get(k) || null
    },
    setItem(k, v) {
      this.data.set(k, v)
    },
    removeItem(k) {
      this.data.delete(k)
    },
  }
  function load(file) {
    file = path.resolve(file)
    if (cache[file]) return cache[file].exports
    const mod = { exports: {} }
    cache[file] = mod
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    new Function("require", "module", "exports", code)(
      (name) => {
        if (name.startsWith("@/actions/"))
          return new Proxy(
            {},
            {
              get: () => async () => {
                calls++
                throw new Error("real server invoked")
              },
            },
          )
        if (name.startsWith("@/")) return load(name.slice(2) + ".ts")
        if (name.startsWith(".")) return load(path.resolve(path.dirname(file), name) + ".ts")
        return require(name)
      },
      mod,
      mod.exports,
    )
    return mod.exports
  }
  return { load, calls: () => calls }
}
test("deterministic season: unique fictional people, club/application/slot/reviewer relationships", () => {
  const h = harness(),
    { createDemoSeed } = h.load("lib/demo/seed.ts")
  const s = createDemoSeed("2026-09-23")
  assert.deepEqual(s, createDemoSeed("2026-09-23"))
  assert.equal(s.clubs.length, 20)
  assert.equal(s.students.length, 200)
  assert.equal(
    new Set(s.students.map((p) => p.profile.firstName + " " + p.profile.lastName)).size,
    200,
  )
  assert.ok(s.students.every((p) => p.email.endsWith("@demo.invalid")))
  for (const club of s.clubs) {
    const apps = s.applications.filter((a) => a.clubId === club.id)
    assert.ok(apps.length >= 30 && apps.length <= 100)
    assert.equal(new Set(apps.map((a) => a.studentId)).size, apps.length)
    assert.ok(s.memberships.filter((m) => m.clubId === club.id).length >= 10)
    for (const a of apps) {
      assert.ok(club.rounds.some((r) => r.id === a.roundId))
      for (const ans of a.answers) assert.ok(club.questions.some((q) => q.id === ans.questionId))
      for (const e of a.evaluations)
        assert.ok(s.memberships.some((m) => m.id === e.interviewerId && m.clubId === a.clubId))
    }
  }
  for (const slot of s.slots.filter((s) => s.applicationId)) {
    const a = s.applications.find((a) => a.id === slot.applicationId)
    assert.equal(a.clubId, slot.clubId)
    assert.equal(a.status, "INTERVIEWING")
  }
  assert.ok(JSON.stringify(s).length < 4000000)
})
test("adapter isolates demo mutations, cross-view scores/decisions, conflicts, refresh and reset", async () => {
  const h = harness(),
    { demoStore, studentApplications, joinedApplication, DEMO_KEY } = h.load("lib/demo/store.ts"),
    api = h.load("lib/workspace-api.ts")
  demoStore.start()
  const base = JSON.stringify(demoStore.get()),
    s = demoStore.get(),
    club = s.clubs[0],
    app = s.applications.find((a) => a.clubId === club.id && a.studentId === s.students[0].id)
  demoStore.mutate((s) => {
    s.perspective = { role: "leader", clubId: club.id }
  })
  await api.submitEvaluation({
    clubId: club.id,
    applicationId: app.id,
    roundName: "Interview",
    score: 9,
    notes: "Demo note",
  })
  assert.ok(
    joinedApplication(app.id).evaluations.some((e) => e.score === 9 && e.notes === "Demo note"),
  )
  await api.setApplicationStatus({
    clubId: club.id,
    applicationId: app.id,
    status: "ACCEPTED",
    expectedStatus: "INTERVIEWING",
  })
  assert.equal(studentApplications().find((a) => a.id === app.id).status, "ACCEPTED")
  await assert.rejects(
    api.setApplicationStatus({
      clubId: club.id,
      applicationId: app.id,
      status: "REJECTED",
      expectedStatus: "INTERVIEWING",
    }),
  )
  await assert.rejects(
    api.moveApplicantRound({
      clubId: club.id,
      applicationId: app.id,
      newRoundId: s.clubs[1].rounds[0].id,
    }),
  )
  await assert.rejects(
    api.getSignedUploadUrl({ fileName: "test.pdf", bucket: "resumes" }),
    /disabled/,
  )
  assert.equal(h.calls(), 0)
  demoStore.stop()
  demoStore.start()
  assert.equal(studentApplications().find((a) => a.id === app.id).status, "ACCEPTED")
  assert.ok(demoStore.get().slots[0].startTime instanceof Date)
  demoStore.reset()
  assert.equal(JSON.stringify(demoStore.get()), base)
  demoStore.stop()
  await assert.rejects(api.getStudentApplications(), /real server/)
  assert.equal(h.calls(), 1)
  assert.ok(localStorage.getItem(DEMO_KEY))
})
test("production access requires explicit switch and verified allowlisted email", () => {
  const { canAccessDemo } = harness().load("lib/demo/access.ts")
  assert.equal(canAccessDemo(undefined, { NODE_ENV: "production" }), false)
  assert.equal(
    canAccessDemo("presenter@virginia.edu", {
      NODE_ENV: "production",
      OUTCLASS_DEMO_ENABLED: "true",
      OUTCLASS_DEMO_ALLOWED_EMAILS: "presenter@virginia.edu",
    }),
    true,
  )
  assert.equal(
    canAccessDemo("student@virginia.edu", {
      NODE_ENV: "production",
      OUTCLASS_DEMO_ENABLED: "true",
      OUTCLASS_DEMO_ALLOWED_EMAILS: "presenter@virginia.edu",
    }),
    false,
  )
  assert.equal(canAccessDemo(undefined, { NODE_ENV: "development" }), false)
})

test("corrupt demo storage resets safely and failed writes retain the previous state", () => {
  const h = harness(),
    { demoStore, DEMO_KEY } = h.load("lib/demo/store.ts")
  localStorage.setItem(DEMO_KEY, JSON.stringify({ version: 1, students: [], clubs: [] }))
  demoStore.start()
  assert.equal(demoStore.get().students.length, 200)
  const before = JSON.stringify(demoStore.get())
  localStorage.setItem = () => {
    throw new Error("Storage full")
  }
  assert.throws(
    () =>
      demoStore.mutate((s) => {
        s.subscriptions = []
      }),
    /Storage full/,
  )
  assert.equal(JSON.stringify(demoStore.get()), before)
  assert.throws(() => demoStore.reset(), /Storage full/)
  assert.equal(JSON.stringify(demoStore.get()), before)
})

 test("demo configuration fails closed consistently across all deployment environments", () => {
  const { getDemoAccess } = harness().load("lib/demo/access.ts")
  for (const VERCEL_ENV of [undefined, "development", "preview", "production"]) {
    for (const NODE_ENV of ["development", "production", "test"]) {
      const env = { VERCEL_ENV, NODE_ENV, OUTCLASS_DEMO_ENABLED: " true ", OUTCLASS_DEMO_ALLOWED_EMAILS: " Presenter@virginia.edu " }
      assert.equal(getDemoAccess("presenter@virginia.edu", env).allowed, true)
      assert.equal(getDemoAccess(undefined, env).reason, "sign-in-required")
      assert.equal(getDemoAccess("other@virginia.edu", env).reason, "not-allowlisted")
      for (const emails of [undefined, "", "*", "presenter@virginia.edu,", "presenter@virginia.edu;other@virginia.edu", "presenter@virginia.edu.evil.com"]) {
        assert.equal(getDemoAccess("presenter@virginia.edu", { ...env, OUTCLASS_DEMO_ALLOWED_EMAILS: emails }).reason, "invalid-configuration")
      }
      assert.equal(getDemoAccess("presenter@virginia.edu", { ...env, OUTCLASS_DEMO_ENABLED: "yes" }).reason, "invalid-configuration")
      for (const flag of [undefined, "", "false"]) assert.equal(getDemoAccess("presenter@virginia.edu", { ...env, OUTCLASS_DEMO_ENABLED: flag }).reason, "disabled")
    }
  }
})

test("demo workspace switching preserves one identity and grants leadership only at MII", async () => {
  const h = harness(), { demoStore, demoUser } = h.load("lib/demo/store.ts"), api = h.load("lib/workspace-api.ts")
  demoStore.start()
  const student = demoUser(), s = demoStore.get()
  assert.equal(student.id, s.students[0].id)
  assert.equal(student.adminRoles.length, 1)
  assert.equal(student.adminRoles[0].clubId, s.clubs[0].id)
  demoStore.mutate(state => { state.perspective = { role: "leader", clubId: state.clubs[0].id } })
  assert.equal(demoUser().id, student.id)
  await api.getClubPipeline(s.clubs[0].id)
  demoStore.mutate(state => { state.perspective = { role: "leader", clubId: state.clubs[1].id } })
  await assert.rejects(api.getClubPipeline(s.clubs[1].id), /perspective/)
  const foreign = s.applications.find(a => a.clubId === s.clubs[1].id && a.status !== "DRAFTING")
  await assert.rejects(api.setApplicationStatus({clubId: foreign.clubId, applicationId: foreign.id, status: "ACCEPTED"}), /perspective/)
  demoStore.stop(); demoStore.start()
  assert.equal(demoStore.get().perspective.role, "student")
  assert.equal(demoUser().id, student.id)
  assert.equal(h.calls(), 0)
})
test("demo interview kits persist drafts and completed interviews without real API calls", async () => {
  const h=harness(), {demoStore}=h.load("lib/demo/store.ts"), api=h.load("lib/workspace-api.ts")
  demoStore.start(); demoStore.mutate(s=>{s.perspective={role:"leader",clubId:s.clubs[0].id}})
  const state=demoStore.get(), club=state.clubs[0], round=club.rounds.find(r=>r.name==="Interview")
  assert.ok(state.clubs.every(c=>c.rounds.every(r=>r.interviewKit.length===3)))
  assert.ok(state.interviews.some(i=>i.clubId===club.id && i.completedAt))
  assert.ok(state.interviews.some(i=>i.clubId!==club.id && i.completedAt))
  const candidate=state.applications.find(a=>a.clubId===club.id && a.roundId===round.id && !state.interviews.some(i=>i.applicationId===a.id && i.completedAt))
  const scope={clubId:club.id,roundId:round.id,applicationId:candidate.id}
  const session=await api.openInterviewSession(scope)
  const draft={...session.draft,overallReview:"Demo saved overall review",score:9}
  const saved=await api.saveInterviewSession({...scope,revision:session.revision,draft})
  assert.equal((await api.openInterviewSession(scope)).draft.overallReview,draft.overallReview)
  const completed=await api.saveInterviewSession({...scope,revision:saved.session.revision,draft,complete:true})
  assert.equal(completed.evaluation.score,9)
  assert.ok(completed.session.completedAt)
  await assert.rejects(api.openInterviewSession({...scope,clubId:state.clubs[1].id}))
  assert.equal(h.calls(),0)
})
test("demo meetings keep member resources private and QR attendance idempotent without live calls",async()=>{
  const h=harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts')
  demoStore.start();const s=demoStore.get(),mii=s.clubs[0]
  const outsider=s.meetings.find(m=>m.audience==='MEMBERS'&&!s.memberships.some(member=>member.clubId===m.clubId&&member.userId===s.students[0].id))
  assert.ok(outsider);assert.ok(!(await api.listMeetings()).some(m=>m.id===outsider.id));await assert.rejects(api.getMeeting(outsider.id))
  demoStore.mutate(state=>{state.perspective={role:'leader',clubId:mii.id}})
  const meeting=demoStore.get().meetings.find(m=>m.clubId===mii.id&&m.audience==='RECRUITMENT'&&m.recap==='')
  const token=await api.issueMeetingCheckIn(mii.id,meeting.id)
  demoStore.mutate(state=>{state.perspective={role:'student',clubId:mii.id}})
  const first=await api.checkInMeeting(meeting.id,token.token),again=await api.checkInMeeting(meeting.id,token.token)
  assert.equal(first.status,'checked-in');assert.equal(again.status,'already-checked-in');assert.equal(first.checkedInAt,again.checkedInAt)
  demoStore.mutate(state=>{state.meetingTokens.forEach(t=>t.expiresAt=new Date(0).toISOString())})
  await assert.rejects(api.checkInMeeting(meeting.id,token.token),/expired/)
  assert.equal(h.calls(),0)
})
