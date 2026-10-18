const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require','module','exports',code)(name => load(['.ts','.tsx'].map(ext => path.join(path.dirname(file), `${name}${ext}`)).find(file => fs.existsSync(file))), mod, mod.exports)
  return mod.exports
}
const { createDemoClock, sampleDemo, prominentDemo } = load('components/landing/demo-clock.ts')
const { demoTimelines } = load('components/landing/demo-timelines.ts')
function harness(timeline = demoTimelines.apply) {
  let now = 0, serial = 0
  const frames = new Map(), renders = []
  const clock = createDemoClock(timeline, sample => renders.push(sample), callback => { frames.set(++serial, callback); return serial }, id => frames.delete(id))
  return { clock, renders, get frames() { return frames.size }, advance(ms) { const end = now + ms; while (now < end) { now = Math.min(end,now+20); const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)) } } }
}
test('every scene has one principal action, a 6–9 second timeline and a held result', () => {
  assert.equal(Object.keys(demoTimelines).length, 11)
  for (const [scene,timeline] of Object.entries(demoTimelines)) {
    assert.equal(timeline.beats.length, 1, scene)
    assert.ok(timeline.duration >= 6000 && timeline.duration <= 9000)
    assert.ok(timeline.result.length > 10)
    assert.ok(timeline.summary.length > 80)
    assert.equal(sampleDemo(timeline,0).progress,0)
    assert.equal(sampleDemo(timeline,timeline.duration).progress,1)
    assert.equal(sampleDemo(timeline,timeline.duration).state,timeline.finalState)
    assert.equal(sampleDemo(timeline,timeline.duration).complete,true)
    for (const beat of timeline.beats) {
      assert.ok(beat.arrive - beat.start >= 650 && beat.arrive - beat.start <= 1200)
      assert.ok(beat.press - beat.arrive >= 400 && beat.press - beat.arrive <= 800)
      assert.ok(beat.clickEnd - beat.press >= 100 && beat.clickEnd - beat.press <= 160)
      assert.ok(beat.end - beat.respond >= 650, 'each outcome has time to settle')
    }
    assert.ok(timeline.duration - timeline.beats.at(-1).respond >= 2200)
  }
})
test('interface responses occur after the deliberate click, from the same progress clock', () => {
  for (const timeline of Object.values(demoTimelines)) {
    let previous = 0
    for (const beat of timeline.beats) {
      assert.equal(sampleDemo(timeline,beat.press + 80).state,previous)
      assert.ok(sampleDemo(timeline,beat.press + 80).pressing > 0)
      assert.equal(sampleDemo(timeline,beat.respond - 1).state,previous)
      assert.equal(sampleDemo(timeline,beat.respond).state,beat.state)
      assert.equal(sampleDemo(timeline,beat.arrive).movement,1)
      previous = beat.state
    }
  }
})
test('offscreen and paused time never advances progress; resuming preserves the same timeline', () => {
  const h = harness()
  h.clock.replay(); h.advance(5000)
  assert.equal(h.clock.sample().elapsed,0)
  h.clock.setEligible(true); h.advance(1600)
  const elapsed = h.clock.sample().elapsed
  h.clock.setEligible(false); h.advance(6000)
  assert.equal(h.clock.sample().elapsed,elapsed)
  assert.equal(h.frames,0)
  h.clock.setEligible(true); h.advance(1000)
  assert.ok(h.clock.sample().elapsed > elapsed)
  h.clock.setPaused(true)
  const paused = h.clock.sample().elapsed
  h.advance(3000); assert.equal(h.clock.sample().elapsed,paused)
  h.clock.setPaused(false); h.advance(1000)
  assert.ok(h.clock.sample().elapsed > paused)
  h.clock.dispose()
})
test('completion stops the clock and remains completed across visibility changes', () => {
  const h = harness()
  h.clock.setEligible(true); h.advance(30000)
  assert.equal(h.clock.sample().complete,true)
  assert.equal(h.frames,0)
  const renderCount = h.renders.length
  h.clock.setEligible(false); h.clock.setEligible(true); h.advance(5000)
  assert.equal(h.renders.length,renderCount)
  h.clock.dispose()
})
test('rapid replay cancels the prior frame, resets the interface and retains one clock', () => {
  const h = harness()
  h.clock.setEligible(true); h.advance(7000)
  assert.ok(h.clock.sample().state > 0)
  for (let i = 0; i < 30; i++) {
    h.clock.replay()
    assert.equal(h.clock.sample().progress,0)
    assert.equal(h.clock.sample().state,0)
    assert.equal(h.frames,1)
  }
  h.advance(30000)
  assert.equal(h.clock.sample().progress,1)
  assert.equal(h.frames,0)
  h.clock.dispose()
})
test('reduced motion presents the completed example and accessible replay stays static', () => {
  const h = harness()
  h.clock.setEligible(true); h.advance(1000); h.clock.setReduced(true)
  assert.equal(h.clock.sample().state,demoTimelines.apply.finalState)
  assert.equal(h.clock.sample().progress,1)
  assert.equal(h.frames,0)
  h.clock.replay(); h.advance(30000)
  assert.equal(h.clock.sample().progress,1)
  assert.equal(h.frames,0)
  h.clock.setReduced(false); h.clock.replay(); h.advance(1000)
  assert.ok(h.clock.sample().progress > 0 && h.clock.sample().progress < 1)
  h.clock.dispose()
})
test('disposing a scene cancels its clock, including when another audience mounts', () => {
  const old = harness(), next = harness(demoTimelines.build)
  old.clock.setEligible(true); old.advance(2000); old.clock.dispose()
  assert.equal(old.frames,0)
  old.clock.setEligible(true); old.clock.replay(); old.advance(5000)
  assert.equal(old.frames,0)
  next.clock.setEligible(true); next.advance(2000)
  assert.ok(next.clock.sample().progress > 0)
  next.clock.dispose()
})
test('prominence selects one scene, resists minor scrolling and adapts to landscape', () => {
  assert.equal(prominentDemo([{id:'a',top:200,height:600},{id:'b',top:700,height:600}],1000),'a')
  assert.equal(prominentDemo([{id:'a',top:80,height:600},{id:'b',top:450,height:600}],1000,'a'),'a')
  assert.equal(prominentDemo([{id:'a',top:-300,height:600},{id:'b',top:310,height:600}],1000,'a'),'b')
  assert.equal(prominentDemo([{id:'a',top:110,height:700}],390),'a')
  assert.equal(prominentDemo([{id:'a',top:900,height:700}],390),undefined)
})
test('Auto-Fill only creates an unpublished proposal; publication is outside this vignette', () => {
  const timeline = demoTimelines['leader-interview']
  assert.deepEqual(timeline.beats.map(beat => beat.target), ['auto-fill'])
  assert.match(timeline.summary, /unpublished draft/)
  assert.match(timeline.result, /Unpublished/)
  const proposal = timeline.beats[0]
  assert.equal(sampleDemo(timeline, proposal.respond - 1).state, 0)
  assert.equal(sampleDemo(timeline, proposal.respond).state, 1)
  assert.equal(sampleDemo(timeline, timeline.duration).label, timeline.result)
})
