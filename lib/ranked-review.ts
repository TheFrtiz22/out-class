import { z } from "zod";

/**
 * Ranked applicant review: a discussion aid for one round (and recruitment
 * cycle). Ranks come from the canonical current-round submitted-score summary
 * already released by the pipeline projection (`roundScore`). Bands are
 * discussion groups only, never Pass/Hold/Do not pass decisions, and nothing
 * here advances, rejects or notifies anyone.
 */

export type RankedBand = "green" | "yellow" | "red";
export const rankedBandLabels: Record<RankedBand, string> = { green: "Green", yellow: "Yellow", red: "Red" };
export const rankedBandOrder: readonly RankedBand[] = ["green", "yellow", "red"];

/** Namespaced key inside PipelineRound.configuration. Existing writers merge and preserve it. */
export const RANKED_REVIEW_CONFIGURATION_KEY = "rankedReviewBands";
/** Scope key for applicants without a recorded cycle (and anonymous rounds, where the cycle is withheld). */
export const RANKED_REVIEW_NO_CYCLE = "no-cycle";
const MAX_RANK = 10000;

const rank = z.number().int().min(1).max(MAX_RANK);
export const rankedBandsSchema = z.object({
  green: z.object({ start: rank, end: rank }).strict(),
  yellow: z.object({ start: rank, end: rank }).strict(),
  red: z.object({ start: rank }).strict(),
}).strict().superRefine((b, ctx) => {
  const issue = (path: string[], message: string) => ctx.addIssue({ code: "custom", path, message });
  if (b.green.start !== 1) issue(["green", "start"], "Green must start at rank 1.");
  if (b.green.end < b.green.start) issue(["green", "end"], "Green must end at or after its first rank.");
  if (b.yellow.start !== b.green.end + 1) issue(["yellow", "start"], "Yellow must start right after Green ends.");
  if (b.yellow.end < b.yellow.start) issue(["yellow", "end"], "Yellow must end at or after its first rank.");
  if (b.red.start !== b.yellow.end + 1) issue(["red", "start"], "Red must start right after Yellow ends.");
});
export type RankedBands = z.infer<typeof rankedBandsSchema>;

export const rankedCycleKeySchema = z.union([z.string().uuid(), z.literal(RANKED_REVIEW_NO_CYCLE)]);
export function rankedCycleKey(cycleId: string | null | undefined) { return cycleId || RANKED_REVIEW_NO_CYCLE; }

/** Validate boundaries: integer ranks ≥ 1, ordered, non-overlapping and contiguous; Red is open-ended. */
export function validateBands(input: unknown): { ok: true; bands: RankedBands } | { ok: false; errors: string[] } {
  const parsed = rankedBandsSchema.safeParse(input);
  return parsed.success ? { ok: true, bands: parsed.data } : { ok: false, errors: [...new Set(parsed.error.issues.map(i => i.message))] };
}

/** Build contiguous bands from the two editable boundaries. */
export function bandsFromBoundaries(greenEnd: number, yellowEnd: number): RankedBands {
  return { green: { start: 1, end: greenEnd }, yellow: { start: greenEnd + 1, end: yellowEnd }, red: { start: yellowEnd + 1 } };
}

const storedScopeSchema = z.object({ bands: rankedBandsSchema, revision: z.number().int().min(0) }).passthrough();
const storedSchema = z.object({ version: z.literal(1), scopes: z.record(z.string(), z.unknown()) }).passthrough();
export type RankedScopeSetting = { bands: RankedBands | null; revision: number };

/** Read every scope from a round configuration. Malformed entries read as unconfigured, never throw. */
export function readRankedReviewSettings(configuration: unknown): Record<string, RankedScopeSetting> {
  const root = configuration && typeof configuration === "object" ? (configuration as Record<string, unknown>)[RANKED_REVIEW_CONFIGURATION_KEY] : undefined;
  const parsed = storedSchema.safeParse(root);
  if (!parsed.success) return {};
  const out: Record<string, RankedScopeSetting> = {};
  for (const [key, value] of Object.entries(parsed.data.scopes)) {
    if (!rankedCycleKeySchema.safeParse(key).success) continue;
    const scope = storedScopeSchema.safeParse(value);
    if (scope.success) out[key] = { bands: scope.data.bands, revision: scope.data.revision };
    else if (value && typeof value === "object" && "revision" in value && Number.isInteger((value as { revision: unknown }).revision))
      out[key] = { bands: null, revision: (value as { revision: number }).revision };
  }
  return out;
}

export function rankedScopeSetting(configuration: unknown, cycleKey: string): RankedScopeSetting {
  return readRankedReviewSettings(configuration)[cycleKey] ?? { bands: null, revision: 0 };
}

/** Returns a new configuration with one scope replaced; every other configuration key and scope is preserved. */
export function withRankedScope(configuration: unknown, cycleKey: string, bands: RankedBands | null, revision: number, meta: Record<string, unknown> = {}) {
  const base = configuration && typeof configuration === "object" && !Array.isArray(configuration) ? configuration as Record<string, unknown> : {};
  const existing = storedSchema.safeParse(base[RANKED_REVIEW_CONFIGURATION_KEY]);
  const scopes = existing.success ? { ...existing.data.scopes } : {};
  scopes[cycleKey] = bands ? { bands, revision, ...meta } : { cleared: true, revision, ...meta };
  return { ...base, [RANKED_REVIEW_CONFIGURATION_KEY]: { version: 1, scopes } };
}

/** Discussion bands are presentation-only; they must never change a round's publication or planning fingerprint. */
export function withoutRankedReviewConfiguration(configuration: unknown): unknown {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration) || !(RANKED_REVIEW_CONFIGURATION_KEY in configuration)) return configuration;
  const { [RANKED_REVIEW_CONFIGURATION_KEY]: _bands, ...rest } = configuration as Record<string, unknown>;
  return rest;
}

export type RankInput = { id: string; average: number | null; submitted: number; visible: boolean };
export type Ranked<T> = T & { rank: number };

/**
 * Competition ranking ("1224") on full-precision averages. Equal averages share
 * a rank; ties are ordered by neutral id only for stable display. Applicants
 * whose score the viewer cannot see are `hidden` (never ranked, never zero);
 * visible applicants without a qualifying submitted score are `notScored`.
 */
export function rankApplicants<T extends RankInput>(rows: readonly T[]) {
  const hidden: T[] = [], notScored: T[] = [], scored: T[] = [];
  for (const row of rows) {
    if (!row.visible) hidden.push(row);
    else if (row.average === null || !Number.isFinite(row.average) || row.submitted < 1) notScored.push(row);
    else scored.push(row);
  }
  const byId = (a: T, b: T) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  scored.sort((a, b) => b.average! - a.average! || byId(a, b));
  const ranked: Ranked<T>[] = [];
  scored.forEach((row, index) => {
    const previous = ranked[index - 1];
    ranked.push({ ...row, rank: previous && previous.average === row.average ? previous.rank : index + 1 });
  });
  return { ranked, notScored: notScored.sort(byId), hidden: hidden.sort(byId) };
}

export function bandForRank(rankValue: number, bands: RankedBands): RankedBand {
  return rankValue <= bands.green.end ? "green" : rankValue <= bands.yellow.end ? "yellow" : "red";
}

/** Tie-safe: a band is decided by shared rank, so tied applicants always share a band. */
export function assignBands<T extends { rank: number }>(ranked: readonly T[], bands: RankedBands | null): (T & { band: RankedBand | null })[] {
  return ranked.map(row => ({ ...row, band: bands ? bandForRank(row.rank, bands) : null }));
}

export type TieExplanation = { band: RankedBand; rank: number; count: number; nominalSize: number; actualSize: number; message: string };

/** Ties that straddle a configured boundary make that band larger than its nominal size. */
export function tieCrossesBoundary(ranked: readonly { rank: number }[], bands: RankedBands | null): TieExplanation[] {
  if (!bands) return [];
  const counts = new Map<number, number>();
  for (const row of ranked) counts.set(row.rank, (counts.get(row.rank) ?? 0) + 1);
  const out: TieExplanation[] = [];
  for (const band of ["green", "yellow"] as const) {
    const { start, end } = bands[band];
    for (const [rankValue, count] of counts) {
      if (rankValue < start || rankValue > end || rankValue + count - 1 <= end) continue;
      const actualSize = ranked.filter(row => row.rank >= start && row.rank <= end).length;
      const nominalSize = end - start + 1;
      out.push({ band, rank: rankValue, count, nominalSize, actualSize,
        message: `${count} applicants tied at rank ${rankValue} are all in ${rankedBandLabels[band]}; the band is larger than ${nominalSize}.` });
    }
  }
  return out;
}

/**
 * Everything the ranked list derives from one scope, in linear time after the
 * sort: ranks, bands, tie notes, the set of tied ranks and per-band members.
 */
export function rankedReviewView<T extends RankInput>(rows: readonly T[], bands: RankedBands | null) {
  const { ranked, notScored, hidden } = rankApplicants(rows);
  const banded = assignBands(ranked, bands);
  const counts = new Map<number, number>();
  for (const row of ranked) counts.set(row.rank, (counts.get(row.rank) ?? 0) + 1);
  const tiedRanks = new Set([...counts].filter(([, count]) => count > 1).map(([rankValue]) => rankValue));
  const byBand: Record<RankedBand, typeof banded> = { green: [], yellow: [], red: [] };
  if (bands) for (const row of banded) byBand[row.band!].push(row);
  return { ranked, notScored, hidden, banded, byBand, tiedRanks, ties: tieCrossesBoundary(ranked, bands) };
}

/** Compares what the ranking observes, so unrelated reads do not prompt a refresh. */
export function rankingSignature(rows: readonly (RankInput & { label?: string; photo?: string | null; status?: string; cycle?: string | null })[]) {
  return JSON.stringify([...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(r => [r.id, r.visible, r.average, r.submitted, r.label ?? null, r.photo ?? null, r.status ?? null, r.cycle ?? null]));
}
