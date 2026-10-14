const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

function compile(filename, mocks, window) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function("require", "module", "exports", "window", code)(name => mocks[name], mod, mod.exports, window)
  return mod.exports
}

function perspectiveHarness(hash) {
  let selected = "student"
  const effects = [], listeners = new Map(), navigation = []
  const window = {
    location: { hash },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name) },
  }
  const content = compile("components/landing/journey-content.ts", {}, window)
  const hook = compile("hooks/use-landing-perspective.ts", {
    react: { useState: () => [selected, next => { selected = next }], useCallback: callback => callback, useEffect: effect => effects.push(effect) },
    "next/navigation": { useRouter: () => ({ replace: (url, options) => navigation.push({ url, options }) }) },
    "@/components/landing/journey-content": content,
  }, window)
  const result = hook.useLandingPerspective()
  const cleanup = effects.map(effect => effect())
  return { get selected() { return selected }, navigation, listeners, cleanup, switch: result.switchPerspective, visit(hash, event = "hashchange") { window.location.hash = hash; listeners.get(event)?.() } }
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
  assert.deepEqual(page.navigation, [{ url: "#club-leaders", options: { scroll: false } }])
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
