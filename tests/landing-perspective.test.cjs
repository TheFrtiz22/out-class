const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

function compile(filename, mocks, window, document) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function("require", "module", "exports", "window", "document", code)(name => mocks[name], mod, mod.exports, window, document)
  return mod.exports
}

function perspectiveHarness(hash, search = "", preference = null, storageBlocked = false) {
  let selected
  const storage = new Map(preference ? [["outclass-landing-audience", preference]] : [])
  const effects = [], listeners = new Map(), navigation = []
  const window = {
    location: { hash, search, protocol: "https:" }, innerHeight: 1000,
    localStorage: { getItem: key => { if (storageBlocked) throw Error("blocked"); return storage.get(key) ?? null }, setItem: (key, value) => { if (storageBlocked) throw Error("blocked"); storage.set(key, value) } },
    history: { replaceState: (_state, _title, url) => navigation.push({ method: "replaceState", url }) },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name) },
  }
  const content = compile("components/landing/journey-content.ts", {}, window)
  const audience = compile("lib/landing-audience.ts", {}, window)
  const document = { querySelectorAll: () => [], querySelector: () => null, documentElement: { dataset: {} }, cookie: "" }
  const hook = compile("hooks/use-landing-perspective.ts", {
    react: { useState: initial => { selected ??= initial; return [selected, next => { selected = next }] }, useRef: value => ({ current: value }), useLayoutEffect: effect => effects.push(effect), useCallback: callback => callback, useEffect: effect => effects.push(effect) },
    "@/components/landing/journey-content": content,
    "@/lib/landing-audience": audience,
  }, window, document)
  const result = hook.useLandingPerspective()
  const cleanup = effects.map(effect => effect()).filter(value => typeof value === "function")
  return { get selected() { return selected }, storage, document, navigation, listeners, cleanup, switch: next => hook.useLandingPerspective().switchPerspective(next), visit(hash, event = "hashchange") { window.location.hash = hash; listeners.get(event)?.() } }
}

test("refreshing either perspective and legacy club links selects the correct walkthrough", () => {
  for (const [hash, expected] of [["#students", "student"], ["#club-leaders", "leader"], ["#clubs", "leader"]]) {
    const page = perspectiveHarness(hash)
    assert.equal(page.selected, expected)
    assert.deepEqual(page.navigation, [])
  }
})

test("switches update the URL without scrolling, and browser history restores the perspective", () => {
  const page = perspectiveHarness("#students")
  page.switch("leader")
  assert.equal(page.selected, "leader")
  assert.deepEqual(page.navigation, [{ method: "replaceState", url: "?audience=leader#club-leaders" }])
  page.visit("#students", "popstate")
  assert.equal(page.selected, "student")
  page.visit("#club-leaders")
  assert.equal(page.selected, "leader")
  page.visit("#about")
  assert.equal(page.selected, "leader")
})

test("leaving the landing page removes both navigation listeners", () => {
  const page = perspectiveHarness("#club-leaders")
  page.cleanup.forEach(cleanup => cleanup())
  assert.equal(page.listeners.size, 0)
})

test("direct numbered chapter links retain their audience, while legacy hashes take precedence", () => {
  assert.equal(perspectiveHarness("#journey-4", "?audience=leader").selected, "leader")
  assert.equal(perspectiveHarness("#students", "?audience=leader").selected, "student")
  assert.equal(perspectiveHarness("#journey-3", "?audience=invalid").selected, "leader")
})

test("first visits default to leaders, manual choices persist, and explicit navigation wins", () => {
  assert.equal(perspectiveHarness("").selected,"leader")
  assert.equal(perspectiveHarness("","","students").selected,"student")
  assert.equal(perspectiveHarness("","","club-leaders").selected,"leader")
  assert.equal(perspectiveHarness("","","invalid").selected,"leader")
  assert.equal(perspectiveHarness("","","students",true).selected,"leader")
  assert.equal(perspectiveHarness("","?audience=leader","students").selected,"leader")
  assert.equal(perspectiveHarness("#students","?audience=leader","club-leaders").selected,"student")
  const page = perspectiveHarness("")
  page.switch("student")
  assert.equal(page.storage.get("outclass-landing-audience"),"students")
  assert.match(page.document.cookie,/outclass-landing-audience=students; Path=\//)
  const blocked = perspectiveHarness("","",null,true)
  blocked.switch("student")
  assert.equal(blocked.selected,"student")
})

test("audience and chapter navigation preserve existing campaign parameters", () => {
  const page = perspectiveHarness("#students", "?campaign=campus")
  page.switch("leader")
  assert.equal(page.navigation[0].url, "?campaign=campus&audience=leader#club-leaders")
  const content = compile("components/landing/journey-content.ts", {}, {})
  assert.equal(content.journeyChapterHref("leader", 3, "campaign=campus&audience=student"), "?campaign=campus&audience=leader#journey-4")
})

test("five student and six leader stages map by task, including interview and membership", () => {
  const content = compile("components/landing/journey-content.ts", {}, {})
  assert.equal(content.journeyChapters.student.length, 5)
  assert.equal(content.journeyChapters.leader.length, 6)
  for (const audience of ["student", "leader"]) {
    for (const chapter of content.journeyChapters[audience]) {
      const other = audience === "student" ? "leader" : "student"
      const equivalent = content.equivalentJourneyStage(chapter.stage, other)
      assert.ok(content.journeyChapters[other].some(chapter => chapter.stage === equivalent))
    }
  }
  assert.equal(content.equivalentJourneyStage("interview", "leader"), "interview")
  assert.equal(content.equivalentJourneyStage("manage", "student"), "belong")
  assert.equal(content.equivalentJourneyStage("track", "leader"), "decide")
  assert.equal(content.journeyChapterHref("leader", 3), "?audience=leader#journey-4")
})

test("hero-to-paper boundary stays crisp with a readable scroll cue", () => {
  const atmosphere = fs.readFileSync("components/landing/journey-atmosphere.css", "utf8")
  const intro = fs.readFileSync("components/landing/intro.css", "utf8")
  const introMarkup = fs.readFileSync("components/landing/landing-intro.tsx", "utf8")
  // The original fade laid a gray translucent strip across the bottom of the photo.
  assert.doesNotMatch(atmosphere, /\.oc-landing\s+\.oc-landing-intro::after\s*\{/)
  assert.match(atmosphere, /\.oc-landing:has\(\.oc-product-stories\) main\s*\{\s*background: var\(--oc-journey-linen\);/)
  assert.match(intro, /\.oc-intro-scroll\s*\{[^}]*z-index: 1;[^}]*safe-area-inset-bottom/)
  assert.match(introMarkup, /<ScrollIndicator[^>]*targetId="about"/)
})
