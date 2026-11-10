import { demoStore, demoMember } from "./store";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { RANKED_REVIEW_NO_CYCLE, rankedBandsSchema, rankedCycleKeySchema, rankedScopeSetting, readRankedReviewSettings, withRankedScope } from "@/lib/ranked-review";

// Demo mirror of actions/ranked-review.ts: same validation, permission and revision rules, fictional store only.
function scope(clubId: string, roundId: string) {
  const s = demoStore.get(), member = demoMember();
  if (s.perspective.role !== "leader" || member.clubId !== clubId) throw Error("Choose a club leader perspective.");
  if (!hasPermission(member, "applicants.identify") && !hasPermission(member, "applications.review")) throw Error("Applicant access denied.");
  const round = s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === roundId && !r.archivedAt);
  if (!round) throw Error("Round unavailable.");
  return { member, round };
}
export function getRankedReviewSettings(clubId: string, roundId: string) {
  const { member, round } = scope(clubId, roundId);
  return { roundId: round.id, scopes: readRankedReviewSettings(round.configuration), cycles: [] as { id: string; name: string }[], canManage: hasPermission(member, "recruitment.manage") };
}
const saveSchema = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid(), cycleKey: rankedCycleKeySchema, expectedRevision: z.number().int().min(0), bands: rankedBandsSchema.nullable() }).strict();
export function saveRankedReviewBands(raw: unknown) {
  const data = saveSchema.parse(raw), { member, round } = scope(data.clubId, data.roundId);
  if (!hasPermission(member, "recruitment.manage")) throw Error("Recruiting configuration access denied.");
  if (data.cycleKey !== RANKED_REVIEW_NO_CYCLE) throw Error("Cycle unavailable.");
  const current = rankedScopeSetting(round.configuration, data.cycleKey);
  if (current.revision !== data.expectedRevision) throw Error("Discussion bands changed. Reload before saving.");
  const revision = current.revision + 1;
  demoStore.mutate(s => {
    const target = s.clubs.find(c => c.id === data.clubId)!.rounds.find(r => r.id === data.roundId)!;
    target.configuration = withRankedScope(target.configuration, data.cycleKey, data.bands, revision) as unknown as typeof target.configuration;
  });
  return { revision, bands: data.bands };
}
