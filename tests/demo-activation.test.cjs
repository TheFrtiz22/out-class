const { test } = require("node:test")
const assert = require("node:assert/strict")
const { harness } = require("./helpers/demo-harness.cjs")

// Every @/actions/* call in the harness is a counted proxy that throws
// "real server invoked", so h.calls() measures live server-action calls.
const pending = Symbol("pending")
const state = (promise, ms = 30) =>
  Promise.race([promise.then(() => "resolved", () => "rejected"), new Promise((resolve) => setTimeout(() => resolve(pending), ms))])

function browser() {
  global.window = { location: new URL("http://localhost/") }
  return () => delete global.window
}

test("requested-but-not-started demo calls wait for the store, then resolve from demo data", async () => {
  const leave = browser()
  try {
    const h = harness(),
      activation = h.load("lib/demo/activation.ts"),
      api = h.load("lib/workspace-api.ts")
    activation.setDemoRequested(true)
    const call = api.getStudentProfile()
    assert.equal(await state(call), pending, "the call waits instead of falling through to the live action")
    const { demoStore, demoUser } = h.load("lib/demo/store.ts")
    demoStore.start()
    const result = await call
    assert.equal(result.profile.id, demoUser().profile.id)
    assert.equal(h.calls(), 0, "no live server action was called")
  } finally {
    leave()
  }
})

test("a failed demo load rejects waiting and later calls without any live call", async () => {
  const leave = browser()
  try {
    const h = harness(),
      activation = h.load("lib/demo/activation.ts"),
      api = h.load("lib/workspace-api.ts"),
      rooms = h.load("lib/voting-room-api.ts")
    activation.setDemoRequested(true)
    const waiting = api.getClubDirectory()
    activation.failDemoActivation()
    await assert.rejects(waiting, { name: "DemoUnavailableError" })
    await assert.rejects(api.getStudentProfile(), { name: "DemoUnavailableError" })
    await assert.rejects(rooms.listLiveVotingRooms({ clubId: "c" }), { name: "DemoUnavailableError" })
    assert.equal(h.calls(), 0, "no live server action was called")
    // A retry clears the failure; a later successful start serves demo data.
    activation.retryDemoActivation()
    const retried = api.getStudentProfile()
    h.load("lib/demo/store.ts").demoStore.start()
    assert.ok((await retried).profile)
    assert.equal(h.calls(), 0)
  } finally {
    leave()
  }
})

test("a stalled demo load times out with an error instead of waiting forever", async () => {
  const leave = browser()
  try {
    const h = harness(),
      activation = h.load("lib/demo/activation.ts")
    activation.setDemoRequested(true)
    assert.equal(activation.DEMO_READY_TIMEOUT_MS, 10_000)
    await assert.rejects(activation.demoGate(20), { name: "DemoUnavailableError" })
    assert.equal(h.calls(), 0)
  } finally {
    leave()
  }
})

test("exiting Demo Mode rejects pending calls rather than sending them to live actions", async () => {
  const leave = browser()
  try {
    const h = harness(),
      activation = h.load("lib/demo/activation.ts"),
      api = h.load("lib/workspace-api.ts")
    activation.setDemoRequested(true)
    const call = api.getStudentProfile()
    activation.setDemoRequested(false)
    await assert.rejects(call, /turned off/)
    assert.equal(h.calls(), 0)
  } finally {
    leave()
  }
})

test("the requested flag is idempotent, so a repeated render keeps a recorded failure", async () => {
  const leave = browser()
  try {
    const activation = harness().load("lib/demo/activation.ts")
    activation.setDemoRequested(true)
    activation.failDemoActivation()
    activation.setDemoRequested(true) // StrictMode's second render
    await assert.rejects(activation.demoGate(), { name: "DemoUnavailableError" })
  } finally {
    leave()
  }
})

test("a server render never sets the requested flag", async () => {
  assert.equal(typeof window, "undefined")
  const h = harness(),
    activation = h.load("lib/demo/activation.ts"),
    api = h.load("lib/workspace-api.ts")
  activation.setDemoRequested(true)
  assert.equal(activation.isDemoRequested(), false)
  assert.equal(await activation.demoGate(), false)
  // With no demo request, adapters use the live action (the harness proxy).
  await assert.rejects(api.getStudentProfile(), /real server invoked/)
  assert.equal(h.calls(), 1)
})

test("after exiting Demo Mode, new calls fail closed until reload and never reach live actions", async () => {
  const leave = browser()
  try {
    const h = harness(),
      activation = h.load("lib/demo/activation.ts"),
      api = h.load("lib/workspace-api.ts"),
      rooms = h.load("lib/voting-room-api.ts"),
      { demoStore } = h.load("lib/demo/store.ts")
    activation.setDemoRequested(true)
    demoStore.start()
    assert.ok((await api.getStudentProfile()).profile)
    // toggleDemo: the cookie is already cleared, then the flag resets and the store stops.
    activation.setDemoRequested(false)
    demoStore.stop()
    await assert.rejects(activation.demoGate(), { name: "DemoUnavailableError" })
    await assert.rejects(api.getStudentProfile(), /turned off/)
    await assert.rejects(rooms.listLiveVotingRooms({ clubId: "c" }), /turned off/)
    assert.equal(h.calls(), 0, "no live server action was called after exit")
  } finally {
    leave()
  }
})

test("calls queued before the store starts all resolve from demo data, in order", async () => {
  const leave = browser()
  try {
    const h = harness(),
      activation = h.load("lib/demo/activation.ts"),
      api = h.load("lib/workspace-api.ts")
    activation.setDemoRequested(true)
    const order = []
    const calls = ["getStudentProfile", "getClubDirectory", "getStudentApplications", "getCorkboard"].map((name) => api[name]().then((value) => (order.push(name), value)))
    h.load("lib/demo/store.ts").demoStore.start()
    const [profile, directory, applications, corkboard] = await Promise.all(calls)
    assert.ok(profile.profile && directory.clubs.length && Array.isArray(applications) && Array.isArray(corkboard.items))
    assert.deepEqual(order, ["getStudentProfile", "getClubDirectory", "getStudentApplications", "getCorkboard"])
    assert.equal(h.calls(), 0)
  } finally {
    leave()
  }
})

test("live (non-demo) calls never load the demo store, seed or implementations", async () => {
  const fs = require("node:fs"),
    path = require("node:path"),
    read = fs.readFileSync,
    files = []
  fs.readFileSync = function (file, ...rest) {
    files.push(path.relative(process.cwd(), String(file)))
    return read.call(this, file, ...rest)
  }
  try {
    const h = harness(),
      api = h.load("lib/workspace-api.ts"),
      rooms = h.load("lib/voting-room-api.ts"),
      observations = h.load("lib/additional-observations-api.ts")
    const live = [
      api.getStudentProfile(),
      api.getClubPipelinePage("club", {}),
      api.saveMeeting({}),
      api.getVotingWorkspace("club", "session"),
      api.commandVotingSession({}),
      rooms.getLiveVotingRoom({ sessionId: "s" }),
      observations.getAdditionalObservations({ clubId: "c" }),
    ]
    for (const call of live) await call.catch(() => {})
    assert.ok(h.calls() >= 5, "live calls reached the live actions")
    assert.ok(files.includes(path.join("lib", "workspace-api.ts")) && files.includes(path.join("lib", "demo", "loader.ts")), "the spy sees the modules the harness loads")
    const demo = files.filter((file) => file.startsWith(path.join("lib", "demo")) && !/lib[\\/]demo[\\/](loader|activation)\.ts$/.test(file))
    assert.deepEqual(demo, [], "only the data-free gate modules load outside Demo Mode")
  } finally {
    fs.readFileSync = read
  }
})
