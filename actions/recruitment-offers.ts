"use server";
import { revokeClubInvitations } from "@/utils/revoke-club-invitations";
import { z } from "zod";
import { clubWriteTransaction } from "@/utils/club-write-transaction";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { respondToRecruitmentOffer } from "@/utils/recruitment-offers";
import { revalidatePath } from "next/cache";
export async function respondToOffer(applicationId: string, response: "ACCEPT" | "DECLINE") {
  z.string().uuid().parse(applicationId); z.enum(["ACCEPT", "DECLINE"]).parse(response);
  const { user } = await requireAuth({ verifyEmail: true });
  const result = await clubWriteTransaction(tx => respondToRecruitmentOffer(tx, applicationId, user.id, response), { maxWait: 2000, timeout: 5000 });
  revalidatePath("/"); return result;
}
export async function revokeRecruitmentOffer(clubId: string, applicationId: string) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(applicationId);
  const { user } = await requireClubPermission(clubId, ["decisions.manage", "applicants.identify"]);
  await clubWriteTransaction(async tx => {
    await authorizeClubTransaction(tx, clubId, user.id, ["decisions.manage", "applicants.identify"]);
    const offer = await tx.clubInvitation.findFirst({ where: { applicationId, clubId } });
    if (!offer) throw Error("Offer unavailable.");
    if (offer.status === "REVOKED") return;
    if (offer.status !== "PENDING") throw Error("Only pending offers can be revoked. Manage existing members through member management.");
    await revokeClubInvitations(tx, { id: offer.id }, user.id, "recruitment.offer.rescind");
  }, { maxWait: 2000, timeout: 5000 });
  revalidatePath("/"); return { success: true };
}
