import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { ChevronDown, ChevronUp, Upload } from "~/components/icons";
import { useConfirm } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Press, TARGET } from "~/components/ui";
import { api, ApiError, errorMessage } from "~/lib/api";
import { type AutosaveState, useAutosave } from "~/lib/autosave";
import { haptics } from "~/lib/haptics";
import { fonts, useTheme } from "~/lib/theme";
import type { ApplicationAnswer, ApplicationsView, StudentApplication } from "~/lib/types";
import { AutosaveStatus } from "./autosave-status";
import { QuestionField } from "./question-field";
import { answerErrors, answersKey, responseProgress, visibleQuestionIds, wordCount } from "./rules";

type Responses = Record<string, string>;
const serializeResponses = (value: Responses) => JSON.stringify(Object.entries(value).filter(([, response]) => response !== "").sort(([a], [b]) => a.localeCompare(b)));
const fromAnswers = (answers: ApplicationAnswer[]): Responses => Object.fromEntries(answers.map(answer => [answer.questionId, answer.response]));

/**
 * The draft application form (web: components/applications/application-form.tsx): the same
 * questions, help text, autosave, Save draft and Review & submit, with the same wording.
 * It renders as direct children of the screen's scroll view so a question can be scrolled to.
 */
export function DraftForm({ application, userId, onScrollTo, onSubmitted, onSaveState }: { application: StudentApplication; userId: string; onScrollTo: (y: number) => void; onSubmitted: () => void; onSaveState?: (state: AutosaveState) => void }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, sheet } = useConfirm();
  const questions = application.club.questions;
  const closed = application.intakeClosed;
  const [responses, setResponses] = useState<Responses>(() => fromAnswers(application.answers));
  const expected = useRef(answersKey(application.answers));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const positions = useRef<Record<string, number>>({});
  const toAnswers = (snapshot: Responses) => questions.map(question => ({ questionId: question.id, response: snapshot[question.id] || "" }));
  const answers = toAnswers(responses);

  const cache = (saved: ApplicationAnswer[]) => queryClient.setQueryData<ApplicationsView>(["applications.view", null], view => view && ({ ...view, applications: view.applications.map(item => item.id === application.id ? { ...item, answers: saved.filter(answer => answer.response !== "") } : item) }));

  /** A refused save: if the server's answers moved on, show them instead of overwriting (optimistic concurrency). */
  async function reconcile(snapshot: Responses) {
    const view = await api.get<ApplicationsView>("applications.view");
    const server = view.applications.find(item => item.id === application.id);
    if (!server) return;
    if (server.status !== "DRAFTING") { queryClient.setQueryData(["applications.view", null], view); return; }
    const key = answersKey(server.answers);
    if (key === expected.current || key === answersKey(toAnswers(snapshot))) return;
    // After the failed save has settled: the server's answers become the form, this device's copy stays readable.
    setTimeout(() => { expected.current = key; cache(server.answers); autosave.adoptServer(fromAnswers(server.answers)); }, 0);
  }

  const autosave = useAutosave<Responses>({
    identity: `application:${application.id}`, owner: userId, value: responses, restore: setResponses, serialize: serializeResponses,
    save: async snapshot => {
      const saved = toAnswers(snapshot);
      try {
        await api.post("applications.saveDraft", { clubId: application.clubId, answers: saved, expectedAnswers: expected.current });
      } catch (cause) {
        if (cause instanceof ApiError && !cause.offline && cause.status !== 401) { setError(errorMessage(cause)); await reconcile(snapshot).catch(() => {}); }
        throw cause;
      }
      expected.current = answersKey(saved);
      cache(saved);
    },
  });
  // Lists and Home re-read once the editor closes.
  useEffect(() => () => { void queryClient.invalidateQueries({ queryKey: ["applications.view"] }); void queryClient.invalidateQueries({ queryKey: ["home.view"] }); }, [queryClient]);

  // The header repeats the save state, so it stays in view while writing further down the form.
  const saveState = autosave.state;
  useEffect(() => { onSaveState?.(saveState); return () => onSaveState?.("idle"); }, [saveState, onSaveState]);

  const locked = busy || autosave.recovery != null;
  // Follow-up questions appear only after the answer they depend on.
  const visible = visibleQuestionIds(questions, answers);
  const shown = questions.filter(question => visible.has(question.id));
  const required = shown.filter(question => question.required);
  const progress = responseProgress(questions, answers);
  const scrollTo = (id?: string) => { const y = id ? positions.current[id] : undefined; if (y !== undefined) onScrollTo(y); };

  function change(id: string, value: string) {
    setResponses(current => ({ ...current, [id]: value }));
    setMessage(""); setError("");
    setErrors(current => { const next = { ...current }; delete next[id]; return next; });
  }

  async function persist(final: boolean) {
    if (busy) return;
    const validation = answerErrors(questions, answers, final);
    setErrors(validation);
    if (Object.keys(validation).length) {
      haptics.error();
      setError("Check the highlighted responses before continuing.");
      scrollTo(Object.keys(validation)[0]);
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      await autosave.flush();
      await api.post(final ? "applications.submit" : "applications.saveDraft", { clubId: application.clubId, answers, expectedAnswers: expected.current });
      expected.current = answersKey(answers);
      await autosave.reset();
      cache(answers);
      if (final) { haptics.confirm(); onSubmitted(); await queryClient.invalidateQueries({ queryKey: ["applications.view"] }); void queryClient.invalidateQueries({ queryKey: ["me"] }); }
      else { haptics.save(); setMessage("Draft saved to your account."); }
    } catch (cause) {
      haptics.error();
      setError(errorMessage(cause, "We couldn’t save your application. Your responses are still here. Please try again."));
      if (cause instanceof ApiError && !cause.offline) await reconcile(responses).catch(() => {});
      onScrollTo(0);
    } finally { setBusy(false); }
  }

  async function review() {
    const validation = answerErrors(questions, answers, true);
    setErrors(validation); setError("");
    if (Object.keys(validation).length) {
      haptics.error();
      setError("A few responses need your attention. Your draft can still be saved.");
      scrollTo(Object.keys(validation)[0]);
      return;
    }
    const confirmed = await confirm({
      title: "Ready to send your application?",
      description: `You’re applying to ${application.club.name}. Your answers cannot be edited after submission.\n\n${progress.completed} of ${required.length} required responses added`,
      confirmLabel: "Submit application", cancelLabel: "Keep editing",
    });
    if (confirmed) await persist(true);
  }

  async function upload(id: string) {
    let picked: DocumentPicker.DocumentPickerResult;
    try { picked = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false }); } catch { return; }
    const file = picked.canceled ? null : picked.assets[0];
    if (!file) return;
    if (!["application/pdf", "application/octet-stream", "", undefined].includes(file.mimeType) || (file.size ?? 0) > 10 * 1024 * 1024) {
      setErrors(current => ({ ...current, [id]: "Choose a PDF up to 10 MB, or add a document link." }));
      setError("The selected document could not be uploaded.");
      return;
    }
    setBusy(true); setError("");
    try {
      const input = new FormData();
      input.append("kind", "resume");
      input.append("file", { uri: file.uri, name: file.name || "document.pdf", type: "application/pdf" } as unknown as Blob);
      const uploaded = await api.post<{ reference: string }>("profile.upload", input);
      change(id, uploaded.reference);
      haptics.save();
      setMessage("Document uploaded. Your attachment will save automatically.");
    } catch {
      haptics.error();
      setError("The document upload failed. Your previous response has not changed.");
    } finally { setBusy(false); }
  }

  const toProfile = () => { autosave.onBlur(); router.push("/profile"); };
  const linkStyle = { textDecorationLine: "underline" as const };

  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text variant="small" testID="draft-progress" style={{ flexShrink: 1 }}>{required.length ? `${progress.completed} of ${required.length} required responses ready` : "No required questions"}</Text>
        <AutosaveStatus save={autosave} />
      </View>

      {application.profileNote ? (
        <Card tone="warm" accessibilityLabel="Missing profile requirements" style={{ gap: 4 }}>
          <Text variant="small" color={colors.foreground}>{application.profileNote}</Text>
          <Press testID="draft-update-profile" disabled={busy} onPress={toProfile} accessibilityLabel="Update profile" style={{ minHeight: TARGET, justifyContent: "center", alignSelf: "flex-start" }}>
            <Text variant="smallStrong" style={linkStyle}>Update profile</Text>
          </Press>
        </Card>
      ) : null}

      {error ? (
        <View accessibilityRole="alert" testID="draft-error" style={{ borderWidth: 1, borderColor: colors.destructive, borderRadius: radius.md, padding: 14, gap: 8, backgroundColor: colors.card }}>
          <Text variant="small" color={colors.destructive}>{error}</Text>
          {questions.filter(question => errors[question.id]).map(question => (
            <Press key={question.id} onPress={() => scrollTo(question.id)} accessibilityLabel={`${question.prompt}: ${errors[question.id]}`} style={{ minHeight: 32, justifyContent: "center" }}>
              <Text variant="small" color={colors.destructive} style={linkStyle} numberOfLines={3}>{question.prompt}: {errors[question.id]}</Text>
            </Press>
          ))}
          {/profile|phone/i.test(error) ? <Button testID="draft-complete-profile" variant="secondary" size="compact" label="Complete profile" onPress={toProfile} /> : null}
        </View>
      ) : null}
      {message ? <Text variant="small" color={colors.foreground} accessibilityRole="alert" testID="draft-message">{message}</Text> : null}
      {closed ? <Text variant="small">Applications are closed. You can still save your draft.</Text> : null}

      {shown.map((question, index) => (
        <View key={question.id} accessibilityLabel={`Question ${index + 1}`} onLayout={event => { positions.current[question.id] = event.nativeEvent.layout.y; }} style={{ gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text variant="caption" style={{ fontFamily: fonts.sansMedium }}>Question {index + 1} · {question.required ? "Required" : "Optional"}</Text>
          <Text variant="bodyStrong" style={{ lineHeight: 24 }}>{question.prompt}</Text>
          <QuestionField question={question} index={index} value={responses[question.id] || ""} onChange={value => change(question.id, value)} onBlur={autosave.onBlur} invalid={!!errors[question.id]} disabled={locked} />
          {question.type === "FILE_UPLOAD" ? (
            <View style={{ gap: 6 }}>
              <Text variant="small" color={colors.foreground}>Or upload a PDF (up to 10 MB)</Text>
              <Button variant="secondary" size="compact" icon={Upload} label="Choose a PDF" disabled={locked} onPress={() => void upload(question.id)} testID={`upload-${index + 1}`} />
            </View>
          ) : null}
          <Text variant="small">
            {question.type === "ESSAY"
              ? `${wordCount(responses[question.id] || "")} words${question.wordLimit != null ? ` · ${question.wordLimit} maximum` : " · No word limit specified"}`
              : question.type === "FILE_UPLOAD"
                ? "Use a document link the club can access. Attachments save automatically; uploading never submits your application."
                : question.type === "MULTIPLE_CHOICE" ? "Select one option. If no choices are listed, ask the club for clarification." : "Enter your response."}
          </Text>
          {errors[question.id] ? <Text variant="small" color={colors.destructive} accessibilityRole="alert">{errors[question.id]}</Text> : null}
        </View>
      ))}
      {!questions.length ? <Text variant="small">This club has not added application questions. Your submission will use your shared profile.</Text> : null}

      {shown.length ? (
        <View style={{ gap: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View accessibilityLabel="Application questions" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <Text variant="caption" style={{ marginRight: 2 }}>Questions</Text>
            {shown.map((question, index) => (
              <Press key={question.id} disabled={busy} onPress={() => scrollTo(question.id)} accessibilityLabel={`Go to question ${index + 1}`} hitSlop={3}
                style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
                <Text variant="smallStrong">{index + 1}</Text>
              </Press>
            ))}
          </View>
          {progress.nextQuestionId && visible.has(progress.nextQuestionId) ? (
            <Press disabled={busy} onPress={() => scrollTo(progress.nextQuestionId)} accessibilityLabel="Continue to next response" style={{ minHeight: TARGET, justifyContent: "center", alignSelf: "flex-start" }}>
              <Text variant="smallStrong" style={linkStyle}>Continue to next response</Text>
            </Press>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <Text variant="caption">Your draft saves automatically. Nothing is submitted until you confirm.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button testID="draft-save" variant="secondary" label="Save draft" disabled={locked} onPress={() => void persist(false)} />
          <Button testID="draft-review" label="Review & submit" loading={busy} disabled={locked || closed} onPress={() => void review()} />
        </View>
      </View>

      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14 }}>
        <Press onPress={() => setProfileOpen(open => !open)} accessibilityLabel="Shared profile & requirements" accessibilityState={{ expanded: profileOpen }} style={{ minHeight: TARGET + 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text variant="smallStrong" style={{ flex: 1 }}>Shared profile & requirements</Text>
          {profileOpen ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
        </Press>
        {profileOpen ? (
          <View style={{ gap: 8, paddingBottom: 10 }}>
            <Text variant="small">Your shared profile gives the club your academic and experience details.</Text>
            <Text variant="small">{application.testRequirementLabel}. Scores are taken from your profile; SAT and ACT are never converted.</Text>
            <Press disabled={busy} onPress={toProfile} accessibilityLabel="Review your profile" style={{ minHeight: TARGET, justifyContent: "center", alignSelf: "flex-start" }}>
              <Text variant="smallStrong" style={linkStyle}>Review your profile</Text>
            </Press>
          </View>
        ) : null}
      </View>
      {sheet}
    </>
  );
}
