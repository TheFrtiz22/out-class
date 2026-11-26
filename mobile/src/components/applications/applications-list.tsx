import { useRouter } from "expo-router";
import { type ReactNode, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StageTabs } from "~/components/applications/stage-tabs";
import { StatusProgress } from "~/components/applications/status-progress";
import { Header, useHeaderInset } from "~/components/header";
import { ArrowRight, CalendarDays, FilePenLine } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, Card, ClubMark, DOCK_CLEARANCE, EmptyState, ErrorState, Press, Skeleton, SkeletonRows, StatusChip, usePullControl, useScreenGutters } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { useApiQuery } from "~/lib/query";
import { useTabScrollToTop } from "~/lib/scroll-to-top";
import { useTheme } from "~/lib/theme";
import type { ApplicationStageId, ApplicationsView, StudentApplication } from "~/lib/types";

/** A draft: required-response progress, deadline, and Continue draft (web: ApplicationManagementCard). */
function DraftCard({ application: app, alumni, onOpen }: { application: StudentApplication; alumni: boolean; onOpen: () => void }) {
  const { colors } = useTheme();
  const { progress, intakeClosed } = app;
  // Alumni keep drafts to read but cannot submit (lib/graduation.ts), as with a closed club.
  const closed = intakeClosed || alumni;
  return (
    <Card style={{ gap: 12 }}>
      <Press large onPress={onOpen} accessibilityLabel={`${app.club.name}, ${app.statusLabel}`} style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <ClubMark name={app.club.name} color={app.club.color} logoUrl={app.club.logoUrl} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="card" numberOfLines={2}>{app.club.name}</Text>
            <Text variant="small">{progress.total ? `${progress.completed} of ${progress.total} required responses ready` : "No required club questions"}</Text>
            <Text variant="small">{app.deadlineLabel ? `Deadline · ${app.deadlineLabel}` : "Deadline not published"}{intakeClosed ? <Text variant="smallStrong"> · Applications closed</Text> : null}</Text>
          </View>
          <StatusChip label={app.statusLabel} code={app.statusCode} />
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel={`Required responses ready for ${app.club.name}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.percent) }} style={{ height: 4, borderRadius: 2, backgroundColor: colors.muted, overflow: "hidden" }}>
          <View style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%`, height: 4, borderRadius: 2, backgroundColor: colors.brandInk }} />
        </View>
        <Text variant="small">{alumni ? "Alumni accounts can’t submit new applications. You can still read this draft." : closed ? "Applications are closed, so this draft can’t be submitted. You can still view or save it." : progress.ready ? "Required responses ready. Review your profile before submitting." : "Your draft is saved; nothing has been submitted."}</Text>
      </Press>
      {/* A closed club cannot take a submission, so continuing is not the primary action. */}
      <Button testID={`application-open-${app.statusCode}`} variant={closed ? "secondary" : "primary"} icon={ArrowRight} label={closed ? "View draft" : "Continue draft"} onPress={onOpen} />
    </Card>
  );
}

/** A submitted application: where it stands and the next step (web: ApplicationStatusCard). */
function StatusCard({ application: app, onOpen, onAction }: { application: StudentApplication; onOpen: () => void; onAction: () => void }) {
  const { colors } = useTheme();
  const { attention, decision, interview } = app;
  return (
    <Card style={{ gap: 12 }}>
      <Press large onPress={onOpen} accessibilityLabel={`${app.club.name}, ${app.statusLabel}`} style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <ClubMark name={app.club.name} color={app.club.color} logoUrl={app.club.logoUrl} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="card" numberOfLines={2}>{app.club.name}</Text>
            <Text variant="small">{decision ? attention ? "Membership offer ready" : "Decision received" : attention ? "Review interview options" : app.round?.name || app.statusLabel}</Text>
          </View>
          <StatusChip label={app.statusLabel} code={app.statusCode} />
        </View>
        <StatusProgress application={app} />
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 3 }}>
          {!decision && interview && !interview.past ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <CalendarDays size={16} color={colors.interview} />
                <Text variant="smallStrong" style={{ flex: 1 }}>Interview · {interview.label}</Text>
              </View>
              <Text variant="small">{interview.location || "Location not provided"}</Text>
            </>
          ) : (
            <>
              <Text variant="smallStrong">{app.statusLabel}</Text>
              <Text variant="small">{attention && decision ? "Accept or decline your club offer." : attention ? "You haven’t booked an interview for this round. Check available times and the club’s instructions." : !decision && interview?.past ? `Interview · ${interview.label}. Check the club’s instructions for next steps.` : app.nextStep}</Text>
            </>
          )}
        </View>
      </Press>
      <Button testID={`application-open-${app.statusCode}`} variant={attention ? "primary" : "secondary"} icon={ArrowRight} label={attention ? decision ? "Review offer" : "Review interview" : "View details"} onPress={onAction} />
    </Card>
  );
}

/**
 * The Applications list. As its own screen (Home's "View all", links) it has Back; as the dock's Apply
 * tab (`tab`) it has the tab header, clears the dock, and `extra` adds a row above the stages.
 */
export function ApplicationsList({ tab = false, extra }: { tab?: boolean; extra?: ReactNode }) {
  const router = useRouter();
  const list = useRef<FlatList<StudentApplication>>(null);
  useTabScrollToTop(list);
  const top = useHeaderInset();
  const insets = useSafeAreaInsets();
  const gutters = useScreenGutters();
  const { colors, space } = useTheme();
  const view = useApiQuery<ApplicationsView>("applications.view");
  const [chosen, setChosen] = useState<ApplicationStageId | null>(null);
  const data = view.data;
  const stage = chosen ?? data?.initialStage ?? "drafts";
  const visible = data?.applications.filter(item => item.stage === stage) ?? [];
  const stageLabel = data?.stages.find(item => item.id === stage)?.label ?? "";
  const open = (app: StudentApplication) => router.push({ pathname: "/application/[id]", params: { id: app.id } });
  // The attention actions go straight to where they are answered: the booking screen, or the letter with its offer.
  const act = (app: StudentApplication) => {
    if (app.attention && !app.decision) router.push({ pathname: "/interview/[applicationId]", params: { applicationId: app.id } });
    else if (app.attention && app.decisionLetters.length) router.push({ pathname: "/decision/[applicationId]", params: { applicationId: app.id } });
    else open(app);
  };

  const pullControl = usePullControl(() => view.refetch(), top);
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        testID="applications-screen"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: top + space.control, ...gutters.padding, paddingBottom: insets.bottom + (tab ? DOCK_CLEARANCE : 24), gap: space.content - 4 }}
        contentInsetAdjustmentBehavior="never"
        data={visible}
        keyExtractor={item => item.id}
        scrollIndicatorInsets={{ top, bottom: tab ? DOCK_CLEARANCE : 0 }}
        refreshControl={pullControl}
        ListHeaderComponent={
          <View style={{ gap: space.content - 4 }}>
            <Text variant="small">Your drafts, applications in review, interviews and decisions.</Text>
            {extra}
            {view.isPending ? (
              <>
                <View style={{ flexDirection: "row", gap: 22 }}>{[64, 78, 84, 80].map((width, index) => <Skeleton key={index} width={width} height={18} />)}</View>
                <SkeletonRows count={3} />
              </>
            ) : view.isError && !data ? (
              <View accessibilityRole="alert">
                <ErrorState message={errorMessage(view.error)} offline={view.error instanceof ApiError && view.error.unreachable} onRetry={() => { void view.refetch(); }} />
              </View>
            ) : data && !data.applications.length ? (
              <EmptyState icon={FilePenLine} title="No applications yet." body="Explore clubs and start an application. Your drafts and submissions appear here." action={<Button testID="applications-explore" label="Explore clubs" onPress={() => (tab ? router.navigate("/explore") : router.dismissTo("/explore"))} />} />
            ) : data ? (
              <>
                <StageTabs label="Application stage" items={data.stages} value={stage} onChange={setChosen} />
                {stage !== "drafts" ? <Text variant="caption">Each club moves you between rounds. Later rounds show what comes next, not an invitation.</Text> : null}
                {view.isError ? <Text variant="caption" accessibilityRole="alert">Couldn’t update your applications. Showing what was last loaded.</Text> : null}
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => item.stage === "drafts" ? <DraftCard application={item} alumni={!!data?.alumni} onOpen={() => open(item)} /> : <StatusCard application={item} onOpen={() => open(item)} onAction={() => act(item)} />}
        ListEmptyComponent={data?.applications.length ? (
          <Card><EmptyState title={`No applications in ${stageLabel}.`} body={stage === "drafts" ? "You have no drafts in progress." : "None of your applications are at this stage right now."} /></Card>
        ) : undefined}
      />
      {tab ? <Header title="Apply" /> : <Header title="Applications" back />}
    </View>
  );
}
