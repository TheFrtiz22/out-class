import type { AppTransactionClient } from "@/utils/prisma"
/** Database-backed validity includes current office, scope, membership and the exact session snapshot. */
export async function validAvailabilityOverrides(tx: AppTransactionClient, clubId: string, roundId: string) {
  return tx.$queryRaw<{ id: string; slotId: string; memberId: string; conditions: string[] }[]>`
    SELECT o.id, o."slotId", o."memberId", o.conditions FROM "InterviewAvailabilityOverride" o
    WHERE o."clubId"=${clubId} AND o."roundId"=${roundId}
      AND public.outclass_valid_availability_override(o.id,o."clubId",o."roundId",o."slotId",o."memberId")`
}
