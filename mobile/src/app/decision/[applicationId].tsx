import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { plainDate } from "~/components/applications/format";
import { LetterPaper } from "~/components/applications/letter-paper";
import { useOfferResponse } from "~/components/applications/offer-card";
import { Header, useHeaderInset } from "~/components/header";
import { ArrowRight, PartyPopper } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, Card, ErrorState, ScreenScroll, Skeleton } from "~/components/ui";
import { api, ApiError } from "~/lib/api";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { ApplicationsView, DecisionLetterView } from "~/lib/types";

/**
 * The decision letter and its offer (web: DecisionLetterView). Opening the letter marks its
 * notification read, as the web does; Accept and Decline go through the confirm sheet.
 */
export default function DecisionScreen() {
  const { applicationId, letterId } = useLocalSearchParams<{ applicationId: string; letterId?: string }>();
  const router = useRouter();
  const top = useHeaderInset();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const letterQuery = useApiQuery<DecisionLetterView>("decisions.letter", letterId ? { applicationId, letterId } : { applicationId }, { staleTime: 0 });
  const applications = useApiQuery<ApplicationsView>("applications.view");
  const data = letterQuery.data;
  const letter = data?.letter?.content;
  const [readError, setReadError] = useState("");
  const marked = useRef<string | null>(null);
  const offerResponse = useOfferResponse(applicationId, letter?.clubName ?? "", "Your response could not be saved. Refresh and try again.");

  const notificationId = data?.notificationId;
  useEffect(() => {
    if (!notificationId || marked.current === notificationId) return;
    marked.current = notificationId;
    api.post("inbox.read", { ids: [notificationId], read: true })
      .then(() => { void queryClient.invalidateQueries({ queryKey: ["inbox"] }); void queryClient.invalidateQueries({ queryKey: ["home.view"] }); })
      .catch(() => setReadError("Your letter is available, but notification read state could not be saved. Please try again."));
  }, [notificationId, queryClient]);

  const now = Date.now();
  const offer = data?.offer ?? null;
  const acceptedLetter = !!data && (!data.letter || data.letter.decision === "ACCEPTED");
  const pending = offer?.status === "PENDING" && +new Date(offer.expiresAt) > now;
  const active = !!data && data.isCurrent && data.currentStatus === "ACCEPTED" && acceptedLetter && !data.suspended && pending;
  // Congratulate only a current, live acceptance: never a historical, declined, revoked or expired offer.
  const celebratory = !!data?.letter && data.letter.decision === "ACCEPTED" && data.isCurrent && data.currentStatus === "ACCEPTED" && !data.suspended
    && !["DECLINED", "REVOKED", "EXPIRED"].includes(offer?.status ?? "") && !(offer?.status === "PENDING" && +new Date(offer.expiresAt) <= now);
  const alumni = !!applications.data?.alumni;
  const message = offerResponse.message || readError;
  const inactive = "Your membership is inactive. Contact the club about reinstatement.";

  const response = data && (acceptedLetter || !data.isCurrent || data.suspended || offer?.status === "ACCEPTED" || message) ? (
    <Card accessibilityLabel="Decision next steps" testID="decision-response" tone={active ? "brand" : "card"} style={{ gap: 10 }}>
      {!data.isCurrent ? <Text variant="small" color={colors.foreground}>This is a historical letter. Your current decision is {data.currentStatus.toLowerCase()}. Offer controls reflect your current record.</Text> : null}
      {data.suspended ? <Text variant="small" color={colors.foreground}>This club is suspended. Offer responses are currently unavailable.</Text> : null}
      {acceptedLetter ? (active ? (
        <>
          <Text variant="section" accessibilityRole="header">Your invitation</Text>
          <Text variant="small" color={colors.foreground}>Please respond by {plainDate(offer!.expiresAt)}.</Text>
          {alumni ? <Text variant="small" color={colors.foreground}>{applications.data!.alumniRefusals.respond}</Text> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
              <Button testID="offer-accept" label="Accept Offer" loading={offerResponse.busy} onPress={() => void offerResponse.respond("ACCEPT", inactive)} />
              <Button testID="offer-decline" variant="secondary" label="Decline Offer" disabled={offerResponse.busy} onPress={() => void offerResponse.respond("DECLINE", inactive)} />
            </View>
          )}
        </>
      ) : (
        <Text variant="small" color={colors.foreground} testID="decision-offer-state">{offer?.status === "ACCEPTED" ? "Your offer was accepted. Your membership is recorded. Current access is managed by the club."
          : offer?.status === "DECLINED" ? "You declined this offer. Your letter remains available."
          : offer?.status === "REVOKED" ? "This offer is no longer active. Contact the club with questions."
          : offer && (offer.status === "EXPIRED" || +new Date(offer.expiresAt) <= now) ? "This offer has expired."
          : "There is no active offer associated with this decision."}</Text>
      )) : null}
      {offer?.status === "ACCEPTED" ? <Button variant="secondary" icon={ArrowRight} label="Open My Clubs" onPress={() => router.push("/")} /> : null}
      {message ? <Text variant="small" color={colors.foreground} accessibilityRole="alert" testID="decision-message">{message}</Text> : null}
    </Card>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="decision-screen" refreshing={letterQuery.isRefetching} onRefresh={() => { void letterQuery.refetch(); }}>
        {letterQuery.isPending ? (
          <View accessibilityLabel="Opening your decision letter…" accessibilityRole="progressbar">
            <Card style={{ gap: 16, paddingVertical: 28 }}>
              <View style={{ alignItems: "center", gap: 8 }}><Skeleton width={150} height={12} /><Skeleton width={180} height={10} /></View>
              <Skeleton width="45%" /><Skeleton width="85%" height={28} /><Skeleton width="40%" />
              <Skeleton height={16} /><Skeleton height={16} /><Skeleton width="92%" height={16} /><Skeleton width="70%" height={16} />
            </Card>
          </View>
        ) : letterQuery.isError && !data ? (
          letterQuery.error instanceof ApiError && letterQuery.error.offline
            ? <ErrorState offline message={letterQuery.error.message} onRetry={() => { void letterQuery.refetch(); }} />
            : <ErrorState message="This letter could not be loaded. Sign in to the account that submitted the application and try again." onRetry={() => { void letterQuery.refetch(); }} />
        ) : !data ? (
          <View accessibilityRole="alert" style={{ gap: 12 }}>
            <Text variant="display" accessibilityRole="header">Decision letter unavailable</Text>
            <Text variant="body">A formal letter is unavailable for this historical decision.</Text>
            <Button variant="secondary" label="Return to Status" onPress={() => (router.canGoBack() ? router.back() : router.replace("/applications"))} />
          </View>
        ) : (
          <>
            {celebratory && letter ? (
              <Card tone="sage" accessibilityLabel="Congratulations" testID="decision-congratulations" style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <PartyPopper size={26} color={colors.success} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="section">Congratulations, {letter.studentName.split(/\s+/)[0] || letter.studentName}!</Text>
                  <Text variant="small" color={colors.foreground}>{letter.clubName} would love to have you. Read your letter, then respond below.</Text>
                </View>
              </Card>
            ) : null}
            {/* An offer waiting on the student comes before the letter, so Accept and Decline are on screen without scrolling. */}
            {active ? response : null}
            {letter ? <LetterPaper content={letter} logo={data.letter ? { applicationId, letterId: data.letter.id } : undefined} /> : (
              <Card style={{ gap: 10, paddingVertical: 24 }}>
                <Text variant="title" accessibilityRole="header">Your decision</Text>
                <Text variant="body">Your application is {data.currentStatus.toLowerCase()}. A formal letter was not issued for this decision.</Text>
              </Card>
            )}
            {!active ? response : null}
          </>
        )}
      </ScreenScroll>
      <Header title="Decision" back />
      {offerResponse.sheet}
    </View>
  );
}
