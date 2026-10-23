const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { distribution } = require('./navigation-audit.cjs');
const digest = body => createHash('sha256').update(body).digest('hex');
function random(seed) { let state = parseInt(digest(seed).slice(0, 8), 16); return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const percentile = (a, p) => [...a].sort((a, b) => a - b)[Math.ceil(a.length * p) - 1];
function pairedBootstrap(pairs, seed, iterations = 10000) {
  assert.ok(pairs.length && pairs.every(p => p.A.length === p.B.length && p.A.length));
  const rng = random(seed), values = { p50DeltaMs: [], p95DeltaMs: [], p50DeltaPercent: [], p95DeltaPercent: [] };
  for (let i = 0; i < iterations; i++) {
    const a = [], b = [];
    for (let p = 0; p < pairs.length; p++) {
      const pair = pairs[Math.floor(rng() * pairs.length)];
      for (let w = 0; w < pair.A.length; w++) { const index = Math.floor(rng() * pair.A.length); a.push(...pair.A[index]); b.push(...pair.B[index]); }
    }
    for (const [name, rank] of [['p50', .5], ['p95', .95]]) { const av = percentile(a, rank), bv = percentile(b, rank); values[name + 'DeltaMs'].push(av - bv); values[name + 'DeltaPercent'].push(100 * (av / bv - 1)); }
  }
  return Object.fromEntries(Object.entries(values).map(([key, a]) => [key, { low: Math.round(percentile(a, .025) * 100) / 100, high: Math.round(percentile(a, .975) * 100) / 100 } ]));
}
function summarize(rows) {
  const requests = rows.flatMap(r => r.requests), visible = requests.filter(r => ['interviewWorkspace', 'interviewRounds', 'assignedRooms'].some(k => r.route === '/api/workspace?kind=' + k));
  const phases = r => Object.fromEntries([...String(r.serverTiming || '').matchAll(/([a-z_]+);dur=([\d.]+)/g)].map(m => [m[1], +m[2]]));
  const names = [...new Set(visible.flatMap(r => Object.keys(phases(r))))];
  return { observations: rows.length, ...Object.fromEntries(['meaningfulMs', 'interactiveMs', 'networkCompleteMs', 'requestCount', 'encodedBodyBytes', 'scriptMs', 'taskMs'].map(k => [k, distribution(rows.map(r => r[k]))])), completePayloadObservations: rows.filter(r => r.requests.every(q => q.encodedBodyBytes !== null)).length, httpErrors: requests.filter(r => r.status >= 400).length, transportFailures: requests.filter(r => r.failed).length, browserErrors: rows.reduce((n, r) => n + r.pageErrorCount, 0), hydrationPhases: rows.flatMap(r => r.hydration || []).map(h => h.phase), all24Links: rows.every(r => r.renderedRooms === 24 && r.openInterviewLinks === 24), visibleGetTtfbMs: distribution(visible.map(r => r.ttfbMs)), serverPhasesMs: Object.fromEntries(names.map(k => [k, distribution(visible.map(r => phases(r)[k]))])), assignedRoomPhasesMs: Object.fromEntries(names.map(k => [k, distribution(visible.filter(r => r.route.endsWith('=assignedRooms')).map(r => phases(r)[k]))])) };
}
function main() {
  const out = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) || '');
  assert.ok(out.startsWith(path.resolve(__dirname, '../docs/performance/phase1/active-workload') + path.sep));
  const protocol = JSON.parse(fs.readFileSync(path.join(out, 'PROTOCOL.json')));
  if (process.argv.includes('--plan')) {
    assert.equal(protocol.completed.length, 0); assert.ok(!fs.readdirSync(out).some(n => n.startsWith('block-')));
    const file = path.join(out, 'ANALYSIS_PLAN.json'); assert.ok(!fs.existsSync(file));
    fs.writeFileSync(file, JSON.stringify({ registeredBeforeCollection: true, createdAt: new Date().toISOString(), analysisSourceSha256: digest(fs.readFileSync(__filename)), primary: 'AB/BA blocks only; A minus B; negative latency delta favors the current hydration fix', control: 'Middle AA pair reported separately, never pooled into AB inference', uncertainty: '10000 deterministic hierarchical paired bootstrap draws: resample four AB/BA pairs, then matched wave indices within each pair; retain all four participants in each sampled wave', interval: 'Percentile 2.5/97.5; descriptive and limited by four pairs on one shared host', metrics: ['click-to-useful-content p50/p95', 'network completion', 'requests', 'body bytes', 'server phase timing', 'all errors and missing links'], exclusions: 'Only the predeclared one-wave warmup per condition per block is excluded from primary timing; all raw observations and failures retained. No load-based exclusions or outlier trimming.', limits: 'No production SLO or equivalence threshold is asserted; intervals cannot prove absence of a small regression.' }, null, 2) + '\n'); return;
  }
  assert.equal(protocol.collectionComplete, true, 'Do not summarize an incomplete study as accepted');
  const blocks = protocol.blocks.map((block, i) => { const file = path.join(out, 'block-' + String(i + 1).padStart(2, '0') + '-' + block.variant + '-measure/browser-samples.json'), bytes = fs.readFileSync(file); return { ...block, index: i, rawSha256: digest(bytes), ...JSON.parse(bytes) }; });
  const primary = blocks.filter(b => b.comparison === 'hydration-wrapper');
  const results = { sourceCommit: protocol.sourceCommit, variants: protocol.variants, method: JSON.parse(fs.readFileSync(path.join(out, 'ANALYSIS_PLAN.json'))), groups: [], pairs: [], sameBuildControl: [], blocks: blocks.map(b => ({ index: b.index, variant: b.variant, pair: b.pair, comparison: b.comparison, rawSha256: b.rawSha256, errors: b.failures, groups: ['cold', 'warm'].map(condition => ({ condition, ...summarize(b.samples.filter(r => r.condition === condition)) })) })) };
  for (const condition of ['cold', 'warm']) {
    for (const variant of ['A', 'B']) results.groups.push({ condition, variant, ...summarize(primary.filter(b => b.variant === variant).flatMap(b => b.samples.filter(r => r.condition === condition))) });
    const pairs = [...new Set(primary.map(b => b.pair))].map(id => {
      const pair = primary.filter(b => b.pair === id), rows = variant => pair.find(b => b.variant === variant).samples.filter(r => r.condition === condition), waves = variant => [...new Set(rows(variant).map(r => r.wave))].sort((a, b) => a - b).map(w => rows(variant).filter(r => r.wave === w).map(r => r.meaningfulMs));
      return { id, order: pair[0].order, A: waves('A'), B: waves('B') };
    });
    results.pairs.push({ condition, individual: pairs.map(p => ({ pair: p.id, order: p.order, A: distribution(p.A.flat()), B: distribution(p.B.flat()) })), hierarchicalPaired95Interval: pairedBootstrap(pairs, protocol.seed + ':' + condition) });
    const control = blocks.filter(b => b.comparison === 'same-build-control'); results.sameBuildControl.push({ condition, first: summarize(control[0].samples.filter(r => r.condition === condition)), second: summarize(control[1].samples.filter(r => r.condition === condition)) });
  }
  const system = JSON.parse(fs.readFileSync(path.join(out, 'SYSTEM.json')));
  results.system = protocol.blocks.map((b, i) => ({ block: i, variant: b.variant, ...Object.fromEntries(['cpuBusyPercent', 'freeMemoryMiB'].map(k => [k, distribution(system.filter(s => s.block === i && s.phase === 'measure').map(s => s[k]))])), loadAverage1: distribution(system.filter(s => s.block === i && s.phase === 'measure').map(s => s.loadAverage[0])) }));
  fs.writeFileSync(path.join(out, 'COMPARISON.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results.groups.map(g => ({ variant: g.variant, condition: g.condition, timing: g.meaningfulMs, errors: g.browserErrors }))));
}
module.exports = { pairedBootstrap, summarize };
if (require.main === module) main();
