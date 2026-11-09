// Synthetic Ranked review benchmark (server read + projection). No database, no .env.
// Run: node scripts/benchmark-ranked-review.cjs [sizes...]   e.g. node scripts/benchmark-ranked-review.cjs 50 300 1000 2000
"use strict";
const b = require("../tests/helpers/ranked-review-benchmark.cjs");

async function measure(size, scored = 4) {
  const rows = b.syntheticApplications(size, scored);
  const h = b.harness(rows);
  const bands = { green: { start: 1, end: 20 }, yellow: { start: 21, end: 40 }, red: { start: 41 } };
  const out = { size };
  // Legacy: the full CRM detail read the Ranked view used before this change.
  const legacyRead = () => h.crm.getClubPipeline(b.clubId, { roundId: b.roundId });
  await legacyRead(); h.stats.fetchedBytes = 0;
  const legacy = await b.time(legacyRead);
  out.legacyServerMs = +legacy.ms.toFixed(1); out.legacyFetchedKB = Math.round(h.stats.fetchedBytes / 5 / 1024); out.legacyPayloadKB = Math.round(JSON.stringify(legacy.result).length / 1024);
  if (h.crm.getRankedReviewRound) {
    const read = () => h.crm.getRankedReviewRound(b.clubId, b.roundId);
    await read(); h.stats.fetchedBytes = 0;
    const current = await b.time(read);
    out.serverMs = +current.ms.toFixed(1); out.fetchedKB = Math.round(h.stats.fetchedBytes / 5 / 1024); out.payloadKB = Math.round(JSON.stringify(current.result).length / 1024);
    if (h.ranked.rankedReviewView) {
      const rows = h.ranked.rankedCandidateRows(current.result, b.roundId);
      const view = await b.time(() => h.ranked.rankedReviewView(rows.filter(r => r.cycle === b.cycleId), bands));
      out.projectionMs = +view.ms.toFixed(2);
    }
  }
  // Legacy per-render projection, inlined exactly as the component computed it on every render.
  const legacyRows = legacy.result.applications.filter(a => a.roundId === b.roundId).map(app => ({ id: app.id, cycle: app.recruitmentCycleId || "no-cycle", visible: !!app.roundScore, average: app.roundScore?.average ?? null, submitted: app.roundScore?.submitted ?? 0 }));
  const legacyView = await b.time(() => {
    const { ranked } = h.ranked.rankApplicants(legacyRows.filter(r => r.cycle === b.cycleId));
    h.ranked.assignBands(ranked, bands); h.ranked.tieCrossesBoundary(ranked, bands);
    return new Set(ranked.filter((r, i) => ranked.some((o, j) => j !== i && o.rank === r.rank)).map(r => r.rank));
  });
  out.legacyProjectionMs = +legacyView.ms.toFixed(2);
  return out;
}

if (require.main === module) (async () => {
  const sizes = process.argv.slice(2).map(Number).filter(Boolean);
  for (const size of sizes.length ? sizes : [50, 300, 1000, 2000]) console.log(JSON.stringify(await measure(size)));
})();
module.exports = { measure };
