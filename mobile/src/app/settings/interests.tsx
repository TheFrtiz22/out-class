import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { AlumniBanner, useIsAlumni } from "~/components/alumni-banner";
import { ChoiceChips } from "~/components/choice-chips";
import { Header, useHeaderInset } from "~/components/header";
import { Text } from "~/components/text";
import { Button, Card, ErrorState, ScreenScroll, Skeleton } from "~/components/ui";
import { ApiError, api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { CLUB_GOALS, INTEREST_CHIPS, MAX_INTERESTS, SELECTIVITY, WEEKLY_HOURS, answersOf, sameAnswers, type InterestAnswers, type InterestSurvey } from "~/lib/interests";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";

const KEY = ["interests", null] as const;

function Question({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <View testID={`interests-${id}`} style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text variant="bodyStrong" accessibilityRole="header" style={{ flex: 1 }}>{title}</Text>
        {note ? <Text variant="caption">{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Settings → Interests (web: app/(workspace)/settings/interests, components/interests/interest-survey-form.tsx):
 * the four survey questions, saved with the revision that was loaded. Only the student sees them.
 */
export default function InterestsSettings() {
  const { colors } = useTheme();
  const top = useHeaderInset();
  const client = useQueryClient();
  const alumni = useIsAlumni();
  const query = useApiQuery<InterestSurvey | null>("interests");
  // The draft keeps the answers and revision it started from, so a background refetch can't slip a newer
  // revision under older edits (the save would then overwrite changes made on the web instead of failing STALE).
  const [draft, setDraft] = useState<{ answers: InterestAnswers; base: InterestAnswers; revision: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean; stale?: boolean } | null>(null);
  const loaded = query.data ? answersOf(query.data) : null;
  const answers = draft?.answers ?? loaded;
  const dirty = !!(draft && !sameAnswers(draft.answers, draft.base));

  const save = useMutation({
    mutationFn: (value: { answers: InterestAnswers; revision: number }) => api.post<InterestSurvey>("interests.save", { ...value.answers, revision: value.revision }),
    onMutate: () => setMessage(null),
    onSuccess: saved => { client.setQueryData(KEY, saved); setDraft(null); setMessage({ text: "Saved", error: false }); haptics.confirm(); },
    onError: error => {
      haptics.error();
      setMessage({ text: errorMessage(error, "Couldn’t save your interests. Try again."), error: true, stale: error instanceof ApiError && error.code === "STALE" });
    },
  });
  const set = (patch: Partial<InterestAnswers>) => {
    if (!answers || !loaded || alumni || save.isPending) return;
    setMessage(null);
    setDraft(current => current
      ? { ...current, answers: { ...current.answers, ...patch } }
      : { answers: { ...loaded, ...patch }, base: loaded, revision: query.data?.revision ?? 0 });
  };
  const reload = async () => { setMessage(null); setDraft(null); await query.refetch(); };
  const full = (answers?.interests.length ?? 0) >= MAX_INTERESTS;

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="settings-interests-screen" onRefresh={dirty ? undefined : () => query.refetch()}>
        <Text variant="small">What you’re into, so we can suggest clubs. Only you see this. Clubs never do.</Text>
        <AlumniBanner action="survey" />
        {answers ? (
          <Card style={{ gap: 22 }}>
            <Question id="into" title="What are you into?" note={`${answers.interests.length} of ${MAX_INTERESTS}`}>
              <ChoiceChips multiple testID="interests-into" label="What are you into?" disabled={alumni || save.isPending} value={answers.interests}
                onChange={value => set({ interests: value.slice(0, MAX_INTERESTS) })}
                options={INTEREST_CHIPS.map(chip => ({ value: chip.id, label: chip.label, disabled: full && !answers.interests.includes(chip.id) }))} />
              {full ? <Text variant="caption">You’ve picked {MAX_INTERESTS}. Remove one to choose another.</Text> : null}
            </Question>
            <Question id="goals" title="What do you want from a club?">
              <ChoiceChips multiple testID="interests-goals" label="What do you want from a club?" disabled={alumni || save.isPending} value={answers.goals}
                onChange={value => set({ goals: value })} options={CLUB_GOALS.map(goal => ({ value: goal.id, label: goal.label }))} />
            </Question>
            <Question id="hours" title="How much time?" note="per week">
              <ChoiceChips testID="interests-hours" label="How much time per week?" disabled={alumni || save.isPending} value={answers.weeklyHours}
                onChange={value => set({ weeklyHours: value })} options={WEEKLY_HOURS.map(option => ({ value: option.id, label: option.label }))} />
            </Question>
            <Question id="selective" title="Open to applying to selective clubs?">
              <ChoiceChips testID="interests-selective" label="Open to applying to selective clubs?" disabled={alumni || save.isPending} value={answers.selectivity}
                onChange={value => set({ selectivity: value })} options={SELECTIVITY.map(option => ({ value: option.id, label: option.label }))} />
            </Question>
            {alumni ? null : (
              <View style={{ gap: 10 }}>
                <Button full size="large" testID="interests-save" label={save.isPending ? "Saving…" : "Save"} loading={save.isPending} disabled={!dirty} onPress={() => { if (draft) save.mutate({ answers: draft.answers, revision: draft.revision }); }} />
                {dirty && !save.isPending ? <Button full variant="ghost" testID="interests-discard" label="Discard changes" onPress={() => { setDraft(null); setMessage(null); }} /> : null}
              </View>
            )}
            {message ? (
              <View style={{ gap: 8 }}>
                <Text testID="interests-message" variant="small" color={message.error ? colors.destructive : colors.foreground} accessibilityRole={message.error ? "alert" : "text"} accessibilityLiveRegion="polite">{message.text}</Text>
                {message.stale ? <Button variant="secondary" testID="interests-reload" label="Load the latest answers" onPress={() => { void reload(); }} /> : null}
              </View>
            ) : null}
          </Card>
        ) : query.isError ? (
          <Card><ErrorState message={errorMessage(query.error, "Couldn’t load your interests.")} offline={query.error instanceof ApiError && query.error.unreachable} onRetry={() => { void query.refetch(); }} /></Card>
        ) : query.isSuccess ? (
          <Card><ErrorState message="Interest answers are private to the student and aren’t available here." /></Card>
        ) : (
          <Card accessibilityLabel="Loading your interests…" accessibilityRole="progressbar" style={{ gap: 18 }}>
            <Skeleton width="56%" height={18} /><Skeleton width="92%" height={40} /><Skeleton width="48%" height={18} /><Skeleton width="80%" height={40} />
          </Card>
        )}
      </ScreenScroll>
      <Header title="Interests" back />
    </View>
  );
}

