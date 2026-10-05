import { after } from "next/server";
import { processInvitationEmails } from "@/utils/invitation-delivery";
/** The outbox is committed before this is scheduled. Cron resumes unfinished work. */
export function scheduleInvitationDelivery(clubId: string) {
  after(async () => {
    try {
      await processInvitationEmails(clubId, 5);
    } catch {
      console.error(
        "Invitation background delivery unavailable; durable outbox retained.",
      );
    }
  });
}
