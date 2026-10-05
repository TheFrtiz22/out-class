const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

// A controlled browser clock tests the playback lifecycle without waiting on real timers.
function harness({ reduced = false, compact = false, observerAvailable = true } = {}) {
  const slots = [], effects = [], cleanups = [], frames = new Map(), observers = []
  let index = 0, frameId = 0, now = 0, key = "student-apply"
  const eventTarget = initial => ({
    ...initial, listeners: new Map(),
    addEventListener(name, fn) { this.listeners.set(name, fn) },
    removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name) },
    dispatch(name) { this.listeners.get(name)?.() },
  })
  const preference = eventTarget({ matches: reduced })
  const screen = eventTarget({ matches: compact })
  const document = eventTarget({ hidden: false })
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  const react = {
    createContext: initial => ({ Provider: "Provider", initial }),
    useContext: context => context.initial,
    useState(initial) {
      const i = index++
      if (!(i in slots)) slots[i] = initial
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial } },
    useEffect(fn, deps) {
      const i = index++
      if (!slots[i] || deps.some((value, j) => value !== slots[i][j])) {
        slots[i] = deps
        effects.push(() => { cleanups[i]?.(); cleanups[i] = fn() })
      }
    },
  }
  const window = { IntersectionObserver: observerAvailable ? Observer : undefined,
    matchMedia: query => query.includes("reduced-motion") ? preference : screen }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync("components/landing/product-motion.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function("require", "module", "exports", "window", "document", "IntersectionObserver", "requestAnimationFrame", "cancelAnimationFrame", code)(
    name => name === "react" ? react : require(name), mod, mod.exports, window, document, Observer,
    fn => { frames.set(++frameId, fn); return frameId }, id => frames.delete(id),
  )
  const renderOnce = () => {
    index = 0
    const tree = mod.exports.ProductMotion({ children: "sample", duration: 4000, resetKey: key })
    tree.props.ref.current = {}
    return tree
  }
  const render = () => {
    renderOnce()
    while (effects.length) effects.shift()()
    return renderOnce()
  }
  const progress = () => render().props.children.props.children.props.value
  render()
  return {
    progress, document, preference, screen, observers,
    get scheduledFrames() { return frames.size },
    visible(ratio, viewportHeight, previewHeight) { observers.at(-1).callback([{
      isIntersecting: ratio > 0, intersectionRatio: ratio,
      rootBounds: viewportHeight ? { height: viewportHeight } : null,
      boundingClientRect: { height: previewHeight || 0 },
    }]) },
    advance(ms) {
      const end = now + ms
      while (now < end) {
        now = Math.min(end, now + 20)
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach(fn => fn(now))
      }
    },
    toggle() { render().props.children.props.value.toggle() },
    reset(value) { key = value; render() },
    dispose() { cleanups.forEach(cleanup => cleanup?.()) },
  }
}

test("previews wait for meaningful visibility, pause offscreen, finish once and never replay on re-entry", () => {
  const h = harness()
  assert.equal(h.progress(), 0)
  h.visible(.1); h.advance(6000)
  assert.equal(h.progress(), 0)
  h.visible(.5); h.advance(1000)
  const partial = h.progress()
  assert.ok(partial > .2 && partial < .3)
  h.visible(0); h.advance(6000)
  assert.equal(h.progress(), partial)
  h.visible(.5); h.advance(4000)
  assert.equal(h.progress(), 1)
  assert.equal(h.scheduledFrames, 0)
  h.visible(0); h.visible(.5); h.advance(1000)
  assert.equal(h.progress(), 1)
  assert.equal(h.scheduledFrames, 0)
  h.dispose()
})

test("toolbar pause and hidden tabs preserve elapsed time, and resume from the same point", () => {
  const h = harness()
  h.visible(.8); h.advance(1000)
  h.toggle()
  const partial = h.progress()
  h.advance(6000)
  assert.equal(h.progress(), partial)
  h.toggle(); h.advance(1000)
  assert.ok(h.progress() > partial)
  h.document.hidden = true; h.document.dispatch("visibilitychange")
  const hiddenProgress = h.progress()
  h.advance(6000)
  assert.equal(h.progress(), hiddenProgress)
  h.document.hidden = false; h.document.dispatch("visibilitychange"); h.advance(3000)
  assert.equal(h.progress(), 1)
  h.dispose()
})

test("changing perspective resets progress and pause state, waits for visibility, and cleans up the previous clock", () => {
  const h = harness()
  h.visible(.8); h.advance(500); h.toggle()
  h.reset("leader-build")
  assert.ok(h.observers[0].disconnected)
  assert.equal(h.progress(), 0)
  h.advance(6000)
  assert.equal(h.progress(), 0)
  h.visible(.8); h.advance(1000)
  assert.ok(h.progress() > .2 && h.progress() < .3)
  h.reset("student-apply")
  assert.equal(h.progress(), 0)
  h.dispose()
  assert.equal(h.scheduledFrames, 0)
  assert.equal(h.document.listeners.size, 0)
  assert.equal(h.preference.listeners.size, 0)
  assert.equal(h.screen.listeners.size, 0)
})

test("reduced motion and unsupported observers show the final state, including after perspective changes", () => {
  for (const options of [{ reduced: true }, { observerAvailable: false }]) {
    const h = harness(options)
    assert.equal(h.progress(), 1)
    h.reset("leader-decide")
    assert.equal(h.progress(), 1)
    assert.equal(h.scheduledFrames, 0)
    h.dispose()
  }
  const h = harness()
  h.visible(.8); h.advance(500)
  h.preference.matches = true; h.preference.dispatch("change")
  assert.equal(h.progress(), 1)
  assert.equal(h.scheduledFrames, 0)
  h.preference.matches = false; h.preference.dispatch("change")
  assert.equal(h.progress(), 1)
  h.dispose()
})

test("compact demos finish sooner and stay complete when resized to desktop", () => {
  const h = harness({ compact: true })
  h.visible(.8); h.advance(3400)
  assert.equal(h.progress(), 1)
  h.screen.matches = false; h.screen.dispatch("change")
  assert.equal(h.progress(), 1)
  assert.equal(h.scheduledFrames, 0)
  h.dispose()
})

test("short landscape viewports start when the preview fills their usable area", () => {
  const h = harness()
  h.visible(.1, 176, 580); h.advance(1000)
  assert.equal(h.progress(), 0)
  h.visible(.25, 176, 580); h.advance(5000)
  assert.equal(h.progress(), 1)
  h.dispose()
})
