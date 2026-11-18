import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AboutSection, ClubEventsSection, ClubIdentity, FaqSection, LifeSection, MembersSection, RecruitmentSection, UnclaimedNotice } from "~/components/explore/club-sections";
import { applicationStatusCode, applicationStatusLabel, clubRecruitment, clubSharePath, recruitmentDate } from "~/components/explore/directory";
import { clubQuery, useSavedClubs } from "~/components/explore/hooks";
import { useNotice } from "~/components/explore/parts";
import { Header, useHeaderInset } from "~/components/header";
import type { IconComponent } from "~/components/icon-factory";
import { ArrowRight, ArrowUpRight, Bookmark, Share } from "~/components/icons";
import { ShareSheet } from "~/components/share-sheet";
import { Text } from "~/components/text";
import { Button, Card, Chip, EmptyState, ErrorState, Press, ScreenScroll, Skeleton, TARGET, statusTone } from "~/components/ui";
import { ApiError, api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { ClubDirectory, MyApplicationSummary, PublicClub, SavedClubs } from "~/lib/types";

const BookmarkFilled: IconComponent = props => <Bookmark {...props} weight="fill" />;
type Account = { applications?: MyApplicationSummary[]; memberships?: { clubId: string }[] };
type StartResult = { applicationId: string } | { applicationId: null; unavailable: string };

export default function ClubPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const queryClient = useQueryClient();
  const notice = useNotice();
  const saved = useSavedClubs(notice.show);
  const me = useApiQuery<Account>("me", undefined, { staleTime: 5 * 60_000 });
  // The list a student came from already holds the club's summary: show it while the full profile loads.
  const summary = () => queryClient.getQueryData<ClubDirectory>(["explore.directory", null])?.clubs.find(item => item.id === id)
    ?? queryClient.getQueryData<SavedClubs>(["clubs.saved", null])?.items.find(item => item.club.id === id)?.club;
  const profile = useQuery({ ...clubQuery(id), placeholderData: () => { const club = summary(); return club ? { club } : undefined; } });
  const club = profile.data?.club ?? null;
  const [now] = useState(() => Date.now());
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  const application = club ? me.data?.applications?.find(item => item.clubId === club.id) : undefined;
  const start = useMutation({
    mutationFn: (clubId: string) => api.post<StartResult>("applications.start", { clubId }),
    onSuccess: result => {
      if (result.applicationId === null) { haptics.error(); setError(result.unavailable); return; }
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["home.view"] });
      void queryClient.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("applications") });
      router.push({ pathname: "/application/[id]", params: { id: result.applicationId } });
    },
    onError: cause => { haptics.error(); setError(errorMessage(cause, "We couldn’t open your application. Please try again.")); },
  });
  const refresh = () => { profile.refetch(); me.refetch(); saved.query.refetch(); };

  let body;
  if (!club && profile.isPending) body = <ClubSkeleton />;
  else if (!club && profile.isError) body = <ErrorState message={errorMessage(profile.error, "We couldn’t load this club. Please try again.")} offline={profile.error instanceof ApiError && profile.error.offline} onRetry={refresh} />;
  else if (!club) body = profile.data?.error ? <ErrorState message={profile.data.error} onRetry={refresh} /> : <EmptyState title="This club is no longer available." action={<Button variant="secondary" label="Browse clubs" onPress={() => router.replace("/explore")} />} />;
  else body = renderClub(club);

  // A plain render function (not a component): the sections keep their state across re-renders.
  function renderClub(club: PublicClub) {
    const recruitment = clubRecruitment(club, now);
    const following = saved.ids.has(club.id);
    const draft = !!application && /draft/i.test(application.status);
    // A rejected student may start a new application in the club's next cycle.
    const reapply = application?.status === "REJECTED" && recruitment.available;
    const closed = !application && !recruitment.available;
    const applyLabel = start.isPending ? "Opening…" : reapply ? "Apply again" : application ? draft ? "Continue draft" : "View status" : "Start application";
    const deadlineText = recruitment.deadline ? `Application deadline: ${recruitmentDate(recruitment.deadline)}` : "";
    const member = me.data?.memberships?.some(item => item.clubId === club.id);
    const apply = () => {
      setError("");
      if (application && !reapply) router.push({ pathname: "/application/[id]", params: { id: application.id } });
      else start.mutate(club.id);
    };
    const follow = (variant: "primary" | "secondary") => (
      <Button full variant={variant} size="large" testID="club-follow" icon={following ? BookmarkFilled : Bookmark} label={following ? "Following" : "Follow"} accessibilityHint={`${following ? "Following" : "Follow"} ${club.name}`} disabled={saved.query.isPending} onPress={() => saved.setSaved(club, !following)} />
    );
    const share = <Button full variant="secondary" size="large" testID="club-share" icon={Share} label="Share" onPress={() => setSharing(true)} />;
    const action = (
      <View style={{ gap: 10 }}>
        {closed ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}>{follow("primary")}</View><View style={{ flex: 1 }}>{share}</View></View>
            <Text variant="small">Applications aren’t open yet · Follow to keep this club in your saved clubs</Text>
          </>
        ) : (
          <>
            <Button full size="large" testID="club-apply" icon={start.isPending ? undefined : ArrowRight} loading={start.isPending} label={applyLabel} onPress={apply} />
            <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}>{follow("secondary")}</View><View style={{ flex: 1 }}>{share}</View></View>
            {deadlineText ? <Text variant="small">{recruitment.closingSoon ? "Closing soon · " : ""}{deadlineText}</Text> : null}
          </>
        )}
        {application ? <Chip label={applicationStatusLabel(application.status)} tone={statusTone(applicationStatusCode(application.status))} /> : null}
        {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" testID="club-action-error">{error}</Text> : null}
      </View>
    );
    const events = (club.publicEvents ?? []).filter(event => +new Date(event.endDate || event.date) >= now);
    return (
      <>
        <ClubIdentity club={club} action={action} />
        {club.claimed === false ? <UnclaimedNotice /> : null}
        <AboutSection club={club}>
          {member ? (
            <Press accessibilityRole="link" accessibilityLabel="Open club workspace" onPress={() => router.push({ pathname: "/my-club/[clubId]", params: { clubId: club.id } })} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: TARGET }}>
              <Text variant="bodyStrong" color={colors.brandInk}>Open club workspace</Text><ArrowUpRight size={14} color={colors.brandInk} />
            </Press>
          ) : null}
        </AboutSection>
        <MembersSection club={club} />
        <RecruitmentSection club={club} deadlineText={deadlineText} expired={recruitment.expired} application={application} />
        <LifeSection club={club} />
        <FaqSection club={club} />
        <ClubEventsSection events={events} onOpen={event => router.push({ pathname: "/events/[id]", params: { id: event.id } })} />
        <ShareSheet open={sharing} onClose={() => setSharing(false)} target={{ path: clubSharePath(club.id), title: club.name, text: `Check out ${club.name} on OutClass`, subtitle: "Anyone with the link can see the club’s public profile.", qrDescription: "Scan to see the club, follow it and apply on OutClass.", shortLink: true }} />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} refreshing={profile.isRefetching && !profile.isPlaceholderData} onRefresh={refresh} testID="club-screen">{body}</ScreenScroll>
      <Header title={club?.name ?? "Club"} back />
      {notice.element}
    </View>
  );
}

function ClubSkeleton() {
  return (
    <View accessibilityLabel="Loading club profile…" accessibilityRole="progressbar" style={{ gap: 16 }}>
      <Card padded={false} style={{ overflow: "hidden" }}>
        <Skeleton height={112} radius={0} />
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton width={72} height={72} radius={16} style={{ marginTop: -52 }} />
          <Skeleton width="70%" height={28} /><Skeleton width="92%" /><Skeleton width="30%" height={11} />
          <Skeleton height={48} radius={24} style={{ marginTop: 8 }} />
        </View>
      </Card>
      <Skeleton width="30%" height={22} />
      <Card style={{ gap: 10 }}><Skeleton /><Skeleton width="94%" /><Skeleton width="80%" /></Card>
    </View>
  );
}
