import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentRef, useCallback, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { DraftForm } from "~/components/applications/draft-form";
import { ApplicationHeading, StatusDetail } from "~/components/applications/status-detail";
import { Header, useHeaderInset } from "~/components/header";
import { Text } from "~/components/text";
import { FilePenLine } from "~/components/icons";
import { Button, Card, EmptyState, ErrorState, ScreenScroll, Skeleton, StatusChip } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import type { AutosaveState } from "~/lib/autosave";
import { usePullRefresh } from "~/lib/pull-refresh";
import { useApiQuery } from "~/lib/query";
import type { ApplicationsView } from "~/lib/types";

/** One application: the draft form while it is a draft, its status once submitted. */
export default function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const top = useHeaderInset();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<AutosaveState>("idle");
  // Always re-read on open: a draft is edited against the server's current answers, never a cached copy.
  const view = useApiQuery<ApplicationsView>("applications.view", undefined, { refetchOnMount: "always" });
  const app = view.data?.applications.find(item => item.id === id);
  const draft = app?.status === "DRAFTING";
  const loading = view.isPending || (draft && !view.isFetchedAfterMount && !view.isError);
  const failed = view.isError && (!app || (draft && !view.isFetchedAfterMount));
  // Coming back (from the profile, a booking or a letter) re-reads the record: profile notes, closing dates and status move on.
  const returned = useRef(false);
  const refetch = view.refetch;
  const pull = usePullRefresh(refetch);
  useFocusEffect(useCallback(() => {
    if (returned.current) void refetch();
    returned.current = true;
  }, [refetch]));

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll {...({ ref: scroll } as object)} top={top} testID="application-screen" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        refreshing={!draft && pull.refreshing} onRefresh={draft ? undefined : pull.onRefresh}>
        {loading ? (
          <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", gap: 12 }}><Skeleton width={48} height={48} radius={12} /><View style={{ flex: 1, gap: 8 }}><Skeleton width="34%" height={12} /><Skeleton width="78%" height={26} /><Skeleton width="56%" height={12} /></View></View>
            <Skeleton width="60%" />
            <Skeleton height={120} radius={12} />
            <Skeleton height={200} radius={12} />
          </View>
        ) : failed ? (
          <ErrorState message={errorMessage(view.error)} offline={view.error instanceof ApiError && view.error.offline} onRetry={() => { void view.refetch(); }} />
        ) : !app ? (
          <Card>
            <EmptyState icon={FilePenLine} title="Application unavailable" body="This application isn’t on your account. It may have been removed, or the link is for another account."
              action={<Button variant="secondary" label="View your applications" onPress={() => router.replace("/applications")} />} />
          </Card>
        ) : draft ? (
          <>
            <ApplicationHeading application={app} eyebrow="Your application">
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <StatusChip label={app.statusLabel} code={app.statusCode} />
                <Text variant="caption" style={{ flexShrink: 1 }}>{app.deadlineLabel ? `Deadline ${app.deadlineLabel}` : "Deadline not published"}</Text>
              </View>
            </ApplicationHeading>
            <DraftForm key={app.id} application={app} userId={view.data!.userId} alumni={view.data!.alumni} onSaveState={setSaveState}
              onScrollTo={y => scroll.current?.scrollTo({ y: Math.max(0, y - top - 12), animated: true })}
              onSubmitted={() => { setNotice("Your application was submitted successfully."); scroll.current?.scrollTo({ y: 0, animated: false }); }} />
          </>
        ) : (
          <StatusDetail application={app} notice={notice} alumniRespond={view.data!.alumni ? view.data!.alumniRefusals.respond : null} onSwitch={() => scroll.current?.scrollTo({ y: 0, animated: false })} />
        )}
      </ScreenScroll>
      <Header title={draft ? "Your application" : "Application"} back actions={draft && saveState !== "idle" ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingHorizontal: 12 }}>
          <Text variant="caption" testID="header-save-state">{saveState === "saved" ? "Saved" : saveState === "error" || saveState === "unreachable" ? "Not saved" : saveState === "offline" ? "Offline" : "Saving…"}</Text>
        </View>
      ) : undefined} />
    </View>
  );
}
