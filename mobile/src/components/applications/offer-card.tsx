import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useConfirm } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import type { StudentApplication } from "~/lib/types";
import { plainDate } from "./format";

/**
 * Accept or decline through the confirm sheet, then `offers.respond`. The server decides
 * (expired, revoked, alumni, suspended): its refusal is shown as written.
 */
export function useOfferResponse(applicationId: string, clubName: string, fallback: string) {
  const queryClient = useQueryClient();
  const { confirm, sheet } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function respond(response: "ACCEPT" | "DECLINE", inactiveMessage: string) {
    if (busy) return;
    const confirmed = await confirm(response === "ACCEPT"
      ? { title: "Accept your offer?", description: `You’ll become a member of ${clubName || "the club"}.`, confirmLabel: "Accept Offer", cancelLabel: "Not yet" }
      : { title: "Decline your offer?", description: `${clubName || "The club"} will be notified, and you won’t be able to accept this offer later.`, confirmLabel: "Decline Offer", cancelLabel: "Keep offer", destructive: true });
    if (!confirmed) return;
    setBusy(true); setMessage("");
    try {
      const result = await api.post<{ status?: string }>("offers.respond", { applicationId, response });
      if (result?.status === "INACTIVE_MEMBERSHIP") { haptics.warning(); setMessage(inactiveMessage); }
      else { haptics.confirm(); setMessage(response === "ACCEPT" ? `Offer accepted. Welcome to ${clubName || "the club"}!` : "Offer declined. The club has been notified."); }
    } catch (error) {
      haptics.error();
      setMessage(errorMessage(error, fallback));
    } finally {
      // Whatever happened, show the record as the server now has it.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applications.view"] }),
        queryClient.invalidateQueries({ queryKey: ["decisions.letter"] }),
        queryClient.invalidateQueries({ queryKey: ["home.view"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["inbox"] }),
      ]).catch(() => {});
      setBusy(false);
    }
  }
  return { respond, busy, message, sheet };
}

/** The club offer on an application without a formal letter (web: RecruitmentOffer). */
export function OfferCard({ application: app, alumniMessage }: { application: StudentApplication; alumniMessage: string | null }) {
  const router = useRouter();
  const offer = useOfferResponse(app.id, app.club.name, "Your response could not be saved. Try again.");
  const status = app.offerStatus;
  const inactive = "Your membership is inactive. Contact an organization owner about reinstatement; this offer cannot restore access.";
  return (
    <Card tone="soft" accessibilityLabel="Club offer" testID="offer-card" style={{ gap: 10 }}>
      {status === "PENDING" && app.status === "ACCEPTED" ? (
        <>
          <Text variant="bodyStrong">Congratulations! Join {app.club.name}</Text>
          <Text variant="small">Accept your offer to become a club member. Respond by {plainDate(app.recruitmentOffer!.expiresAt)}.</Text>
          {alumniMessage ? <Text variant="small">{alumniMessage}</Text> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              <Button testID="offer-accept" label="Accept Offer" loading={offer.busy} onPress={() => void offer.respond("ACCEPT", inactive)} />
              <Button testID="offer-decline" variant="secondary" label="Decline Offer" disabled={offer.busy} onPress={() => void offer.respond("DECLINE", inactive)} />
            </View>
          )}
        </>
      ) : status === "ACCEPTED" ? (
        <>
          <Text variant="body">Your offer was accepted. Your club membership is recorded.</Text>
          <Button variant="secondary" label="Open your club" onPress={() => router.push({ pathname: "/my-club/[clubId]", params: { clubId: app.clubId } })} />
          <Text variant="caption">Current membership access is managed by the club.</Text>
        </>
      ) : (
        <Text variant="small">{status === "DECLINED" ? "You declined this offer. Your accepted recruitment decision remains recorded."
          : status === "REVOKED" ? "This offer has been rescinded. Contact the club with questions."
          : status === "EXPIRED" ? "This offer has expired. Contact the club with questions."
          : "The club has not issued an offer on OutClass. Contact the club for joining instructions."}</Text>
      )}
      {offer.message ? <Text variant="small" accessibilityRole="alert">{offer.message}</Text> : null}
      {offer.sheet}
    </Card>
  );
}
