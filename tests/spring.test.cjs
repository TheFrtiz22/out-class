// Spring and gesture physics (lib/spring.ts) and the CSS tokens that mirror them.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync('lib/spring.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const m = { exports: {} }; new Function('module', 'exports', code)(m, m.exports)
const s = m.exports

test('the JS spring curves match the CSS tokens', () => {
  const css = fs.readFileSync('styles/tokens.css', 'utf8')
  assert.ok(css.includes(`--oc-spring: ${s.SPRING};`))
  assert.ok(css.includes(`--oc-spring-bounce: ${s.SPRING_BOUNCE};`))
  assert.equal(s.springDuration(0.35), 515)
})

test('critically damped curve never overshoots; the bounce curve overshoots a little and settles', () => {
  const pts = c => c.slice(7, -1).split(',').map(Number)
  const ui = pts(s.SPRING), b = pts(s.SPRING_BOUNCE)
  assert.ok(ui.every((v, i) => i === 0 || v >= ui[i - 1]), 'monotonic')
  assert.ok(Math.max(...ui) <= 1)
  assert.ok(Math.max(...b) > 1 && Math.max(...b) < 1.03)
  assert.equal(ui.at(-1), 1); assert.equal(b.at(-1), 1)
})

test('projection follows the exponential-decay form and is symmetric', () => {
  assert.ok(Math.abs(s.project(1000) - 499) < 1)
  assert.equal(s.project(-1000), -s.project(1000))
  assert.equal(s.project(0), 0)
})

test('rubberband resists progressively and never exceeds the raw overshoot', () => {
  const a = s.rubberband(50, 400), b = s.rubberband(200, 400)
  assert.ok(a > 0 && a < 50 && b < 200 && b > a)
  assert.ok(b - a < 150, 'each extra pixel moves the element less')
  assert.equal(s.rubberband(-50, 400), -a)
})

test('velocity uses only the last 100ms, so a pause before release reads as still', () => {
  const v = s.createVelocityTracker()
  v.add(0, 0); v.add(10, 16); v.add(20, 32); v.add(30, 48)
  assert.ok(Math.abs(v.velocity() - 625) < 1)
  v.add(30, 300)
  assert.equal(v.velocity(), 0)
})
