const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const compiled = ts.transpileModule(fs.readFileSync("lib/feature-orbit.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = { exports: {} }
new Function("module", "exports", compiled)(mod, mod.exports)
const { orbitOffset, orbitPose } = mod.exports

test("every stop has a stable, upright reading interval despite small scroll changes", () => {
  for (let index = 0; index < 6; index++) {
    for (const drift of [-.2, -.01, 0, .01, .2]) {
      const pose = orbitPose(orbitOffset(index + drift, index), 1040)
      assert.equal(Math.abs(pose.rotation), 0)
      assert.equal(pose.opacity, 1)
      assert.equal(pose.scale, 1)
    }
  }
})

test("the sequence has at most one upright demo and no discontinuities in either direction", () => {
  for (const count of [5, 6]) {
    let previous = Array.from({ length: count }, (_, i) => orbitOffset(0, i))
    for (let position = .001; position <= count - 1; position += .001) {
      const offsets = Array.from({ length: count }, (_, i) => orbitOffset(position, i))
      assert.ok(offsets.filter(value => value === 0).length <= 1)
      offsets.forEach((value, i) => {
        assert.ok(Math.abs(value - previous[i]) < .003)
        assert.ok(value <= previous[i] + 1e-10)
      })
      previous = offsets
    }
  }
})

test("neighboring panels travel around the same wheel with complementary rotations", () => {
  const outgoing = orbitPose(orbitOffset(.5, 0), 1040)
  const incoming = orbitPose(orbitOffset(.5, 1), 1040)
  assert.equal(outgoing.x, -incoming.x)
  assert.equal(outgoing.y, incoming.y)
  assert.equal(outgoing.rotation, -incoming.rotation)
  assert.equal(outgoing.opacity, incoming.opacity)
  assert.ok(outgoing.y > 0)
  assert.ok(Math.abs(outgoing.rotation) < 12)
  assert.ok(orbitPose(1, 1040).x > 1040)
  assert.equal(orbitPose(1, 1040).opacity, 0)
})

test("motion eases to rest at the reading boundary and retraces exactly when scrolling back", () => {
  const nearStop = orbitOffset(.2201, 0)
  assert.ok(Math.abs(nearStop) < .000001)
  const forward = Array.from({ length: 101 }, (_, i) => orbitPose(orbitOffset(i / 100, 0), 1040))
  const backward = Array.from({ length: 101 }, (_, i) => orbitPose(orbitOffset((100 - i) / 100, 0), 1040))
  assert.deepEqual(forward, backward.reverse())
})
