import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Field } from "~/components/field";
import type { InterviewEntry, InterviewSession } from "~/components/leader/interviews";
import { Text } from "~/components/text";
import { Button, Skeleton } from "~/components/ui";
import { ApiError, api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { registerPrivateStore } from "~/lib/private-memory";
import { useTheme } from "~/lib/theme";

type SaveState = "idle" | "saving" | "error" | "conflict";
const SAVE_DELAY = 1500;

/**
 * The interviewer's private notes for one interview, through the interview room's own session path
 * (openInterviewSession / saveInterviewSession). Every save sends the revision it was written
 * against; when the server holds a newer draft the save is refused, its message is shown, and the
 * notes are reloaded: the app never writes over a newer draft. Notes live in this component's state
 * only: never on disk, never logged, and cleared with the rest of the app's private memory.
 */
export function InterviewNotes({ entry }: { entry: InterviewEntry }) {
  const { colors } = useTheme();
  const scope = { clubId: entry.clubId, applicationId: entry.applicationId!, roundId: entry.roundId };
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [openError, setOpenError] = useState("");
  const [opening, setOpening] = useState(true);
  const live = useRef({ session, notes, saved, state, busy: false, mounted: true });
  live.current.session = session; live.current.notes = notes; live.current.saved = saved; live.current.state = state;

  async function open() {
    setOpening(true); setOpenError(""); setMessage(""); setState("idle");
    try {
      const opened = await api.post<InterviewSession>("leader.interviewSession.open", scope);
      if (!live.current.mounted) return;
      const text = opened.draft.additionalNotes ?? opened.draft.overallReview ?? "";
      setSession(opened); setNotes(text); setSaved(text);
    } catch (failure) {
      if (live.current.mounted) { setSession(null); setOpenError(errorMessage(failure, "Your interview could not be opened. Retry, or refresh your access.")); }
    } finally { if (live.current.mounted) setOpening(false); }
  }

  async function save() {
    const current = live.current;
    if (current.busy || !current.session || current.session.completedAt || current.state === "conflict" || current.notes === current.saved) return;
    current.busy = true;
    const text = current.notes, record = current.session;
    if (current.mounted) setState("saving");
    try {
      const result = await api.post<{ session: InterviewSession }>("leader.interviewSession.save", { ...scope, revision: record.revision, draft: { ...record.draft, additionalNotes: text } });
      if (current.mounted) { setSession({ ...record, ...result.session }); setSaved(text); setState("idle"); setMessage(""); }
    } catch (failure) {
      if (!current.mounted) return;
      haptics.error();
      // A newer draft exists (another device or the web room): stop saving, say so, and offer the reload.
      if (failure instanceof ApiError && failure.status === 409) { setState("conflict"); setMessage(failure.message); }
      else { setState("error"); setMessage(errorMessage(failure, "Your interview could not be saved. Retry, or refresh your access and revision.")); }
    } finally {
      current.busy = false;
      // Text typed while the save was in flight goes out next, against the new revision.
      if (current.mounted && live.current.state !== "conflict" && live.current.state !== "error" && live.current.notes !== text) void save();
    }
  }

  useEffect(() => {
    live.current.mounted = true;
    void open();
    const forget = registerPrivateStore(() => { setSession(null); setNotes(""); setSaved(""); setOpenError("Your notes were cleared from this phone’s memory. Open the interview again."); });
    return () => { void save(); live.current.mounted = false; forget(); };
    // One session per mounted interview; the parent keys this component by interview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!session || notes === saved || state === "conflict" || state === "error") return;
    const timer = setTimeout(() => { void save(); }, SAVE_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, saved, state, session?.revision]);

  if (opening && !session) return <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 8 }}><Skeleton width="40%" /><Skeleton width="100%" height={120} /></View>;
  if (!session) {
    return (
      <View accessibilityRole="alert" style={{ gap: 8 }}>
        <Text variant="small" color={colors.destructive} testID="interview-open-error">{openError}</Text>
        <Button label="Retry" variant="secondary" size="compact" onPress={() => { void open(); }} />
      </View>
    );
  }
  const readOnly = !!session.completedAt;
  const status = readOnly ? "Submitted · Read only" : state === "conflict" || state === "error" ? "Couldn’t save" : state === "saving" || notes !== saved ? "Saving…" : "All changes saved";
  return (
    <View style={{ gap: 10 }} testID="interview-notes">
      {session.instructions ? <Text variant="small">{session.instructions}</Text> : null}
      <Field label="Miscellaneous notes" testID="interview-notes-field" value={notes} onChangeText={setNotes} editable={!readOnly && state !== "conflict"} multiline maxLength={20000}
        autoCorrect autoCapitalize="sentences" textContentType="none" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text variant="small" testID="interview-save-status" accessibilityLiveRegion="polite" style={{ flex: 1 }} color={state === "conflict" || state === "error" ? colors.destructive : undefined}>{status}</Text>
        {state === "error" ? <Button label="Retry" variant="ghost" size="compact" testID="interview-save-retry" onPress={() => { setState("idle"); }} /> : null}
        {state === "conflict" ? <Button label="Reload" variant="secondary" size="compact" testID="interview-reload" onPress={() => { void open(); }} /> : null}
      </View>
      {message ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" testID="interview-save-message">{message}</Text> : null}
    </View>
  );
}
