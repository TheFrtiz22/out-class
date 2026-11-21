import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AlumniBanner, useIsAlumni } from "~/components/alumni-banner";
import { Field } from "~/components/field";
import { Header, useHeaderInset } from "~/components/header";
import { ArrowUpRight, CalendarClock, CheckCircle2, Download, FilePenLine, Plus } from "~/components/icons";
import { isClosed, isMissing, isSubmitted, ownTasks, relativeDue, taskDate, taskLink, taskResources, taskState, useTaskWorkspaces, workspaceKey } from "~/components/tasks/presentation";
import { Text } from "~/components/text";
import { Button, Card, Chip, Divider, EmptyState, ErrorState, Press, ScreenScroll, Skeleton, TARGET } from "~/components/ui";
import { api, ApiError, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { openExternal } from "~/lib/links";
import { usePullRefresh } from "~/lib/pull-refresh";
import { useApiQuery } from "~/lib/query";
import { MAX_TASK_FILES, TASK_FILE_MIME_TYPES, TaskUploadError, taskFileProblem, uploadTaskFile, type UploadedTaskFile } from "~/lib/task-files";
import { useTheme } from "~/lib/theme";
import type { ClubTask, Me, TaskAssignment } from "~/lib/types";

const REQUIREMENT_LABELS: Record<string, string> = { TEXT: "a written response", LINK: "a link", FILE: "a file" };
const STALE_MESSAGE = "This task changed since you opened it. Your text and new files are kept. Check them and submit again.";

/** What the student typed, held by the screen: a reload with a new revision remounts the form, and an error state unmounts it. */
type Draft = { id: string; text: string; link: string };
/** Uploads not yet submitted, held by the screen for the same reason; an upload that finishes after a remount still lands here. */
type Pending = { id: string; files: UploadedTaskFile[] };

/** The web's submission form (components/club-tasks.tsx `Submission`): written response, link, files. */
function Submission({ task, own, clubName, saved, onSaved, draft, onDraft, stale, onStale, pending, onPending }: { task: ClubTask; own: TaskAssignment; clubName: string; saved: boolean; onSaved: (saved: boolean) => void; draft: Draft | null; onDraft: (draft: Draft | null) => void; stale: boolean; onStale: (stale: boolean) => void; pending: UploadedTaskFile[]; onPending: (update: (files: UploadedTaskFile[]) => UploadedTaskFile[]) => void }) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const alumni = useIsAlumni();
  const closed = isClosed(task, own);
  // A closed submission shows what the server holds; an open one keeps what was typed before a reload.
  const kept = !closed && draft?.id === own.id ? draft : null;
  const [text, setTextState] = useState(kept?.text ?? own.text ?? "");
  const [link, setLinkState] = useState(kept?.link ?? own.link ?? "");
  const setText = (value: string) => { setTextState(value); onDraft({ id: own.id, text: value, link }); };
  const setLink = (value: string) => { setLinkState(value); onDraft({ id: own.id, text, link: value }); };
  const [error, setError] = useState("");
  // The files the submission will carry: those already attached, plus new uploads until it is saved.
  // New uploads live with the screen (`pending`), so a reload that remounts this form keeps them.
  const [attached, setAttached] = useState<(UploadedTaskFile & { attached?: boolean })[]>(() => own.files.map(file => ({ id: file.id, name: file.name, size: file.size, attached: true })));
  const files: (UploadedTaskFile & { attached?: boolean })[] = [...attached, ...(closed ? [] : pending.filter(file => !attached.some(item => item.id === file.id)))];
  const [uploading, setUploading] = useState(false);
  // The revision the next submit is checked against: a save raises it by one before the reload arrives.
  const revision = useRef(own.revision);
  const setSaved = onSaved;
  const required = (type: string) => (task.requirements.includes(type) ? "Required" : "Optional");
  /** The server's own checks (lib/tasks.ts validateTaskSubmission), said before sending. */
  const missing = (address: string) =>
    task.requirements.includes("TEXT") && !text.trim() ? "Add a written response before submitting."
      : task.requirements.includes("LINK") && !address ? "Add a link before submitting."
      : task.requirements.includes("FILE") && !files.length ? "Add a file before submitting."
      : !text.trim() && !address && !files.length ? "Add a response, link, or file before submitting." : null;

  const submit = useMutation({
    // The server checks every field, each file's contents and the revision.
    // The files are fixed when the tap happens, so an upload that finishes while this is in flight is not counted as sent.
    mutationFn: ({ address, sent }: { address: string; sent: string[] }) => api.post("tasks.submit", { assignmentId: own.id, revision: revision.current, text: text.trim(), link: address, fileIds: sent }),
    onMutate: ({ address }) => { setError(""); setSaved(false); onStale(false); if (address !== link.trim()) setLink(address); },
    onSuccess: (_result, { sent }) => {
      // The server raised the revision and now holds these files, so a second tap before the reload isn't refused as changed.
      revision.current += 1;
      setAttached(files.filter(file => sent.includes(file.id)).map(file => ({ ...file, attached: true }))); onPending(current => current.filter(file => !sent.includes(file.id)));
      haptics.confirm(); setSaved(true); onDraft(null);
      client.invalidateQueries({ queryKey: ["tasks.workspace"] });
      client.invalidateQueries({ queryKey: ["home.view", null] });
      client.invalidateQueries({ queryKey: ["home.taskNotifications", null] });
    },
    onError: reason => {
      haptics.error();
      // Reviewed or changed elsewhere (STALE), or closed (CLOSED): the app re-reads the task itself, since it has
      // no "reload the page". The typed text is held by the screen, so the new revision's form keeps it.
      if (reason instanceof ApiError && (reason.code === "STALE" || reason.code === "CLOSED")) void client.invalidateQueries({ queryKey: workspaceKey(task.clubId) });
      if (reason instanceof ApiError && reason.code === "STALE") { onStale(true); return; }
      setError(errorMessage(reason, "Could not save. Please try again."));
    },
  });
  const download = useMutation({
    mutationFn: (fileId: string) => api.get<{ url: string }>("tasks.file", { fileId }),
    onMutate: () => setError(""),
    onSuccess: ({ url }) => { openExternal(url); },
    onError: reason => { haptics.error(); setError(errorMessage(reason, "Download failed.")); },
  });

  async function addFiles() {
    if (uploading || submit.isPending) return;
    setError("");
    let picked: DocumentPicker.DocumentPickerResult;
    try { picked = await DocumentPicker.getDocumentAsync({ type: TASK_FILE_MIME_TYPES, copyToCacheDirectory: true, multiple: true }); } catch { setError("Couldn’t open your files. Try again."); return; }
    if (picked.canceled || !picked.assets?.length) return;
    if (picked.assets.length + files.length > MAX_TASK_FILES) { haptics.error(); setError("Choose up to five files."); return; }
    const problem = picked.assets.map(asset => taskFileProblem(asset)).find(Boolean);
    if (problem) { haptics.error(); setError(problem); return; }
    setUploading(true); setSaved(false);
    try {
      for (const asset of picked.assets) {
        const uploaded = await uploadTaskFile(own.id, asset);
        onPending(current => [...current, uploaded]);
      }
      haptics.tick();
    } catch (reason) {
      haptics.error();
      setError(reason instanceof TaskUploadError ? reason.message : errorMessage(reason, "Upload failed."));
    } finally { setUploading(false); }
  }

  return (
    <Card style={{ gap: 14 }} testID="task-submission">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <FilePenLine size={20} color={colors.foreground} />
        <Text variant="section" accessibilityRole="header">Your submission</Text>
      </View>
      <Text variant="small">
        {own.submittedAt ? `Submitted ${taskDate(own.submittedAt)}${closed ? "" : " · You can update it until it is reviewed or the task closes."}` : "No submission yet. Late submissions are accepted while the task is open and are labeled late."}
      </Text>
      <Text variant="caption">
        Required: {task.requirements.length ? task.requirements.map(value => REQUIREMENT_LABELS[value] ?? value.toLowerCase()).join(" and ") : "a written response, a link, or a file"}. {closed ? "This submission is closed." : "Submit when ready to share it."}
      </Text>
      <Field testID="task-text" label={`Written response · ${required("TEXT")}`} multiline maxLength={30000} editable={!closed && !alumni && !submit.isPending} value={text} onChangeText={value => { setText(value); setSaved(false); }} />
      <Field testID="task-link" label={`Website or document link · ${required("LINK")}`} maxLength={2000} editable={!closed && !alumni && !submit.isPending} value={link} onChangeText={value => { setLink(value); setSaved(false); }} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />

      <View style={{ gap: 6 }}>
        <Text variant="smallStrong">File upload · {required("FILE")}</Text>
        {files.map(file => (
          <View key={file.id} testID={`task-file-${file.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: TARGET }}>
            <Text variant="small" color={colors.foreground} style={{ flex: 1 }} numberOfLines={2}>{file.name} · {Math.ceil(file.size / 1024)} KB{file.attached ? "" : " · Not submitted yet"}</Text>
            {file.attached ? <Button variant="ghost" size="compact" icon={Download} label="Download" accessibilityHint={file.name} loading={download.isPending && download.variables === file.id} onPress={() => download.mutate(file.id)} /> : null}
            {closed || alumni ? null : <Button variant="ghost" size="compact" testID={`task-file-remove-${file.id}`} label="Remove" accessibilityHint={file.name} disabled={uploading || submit.isPending} onPress={() => { setAttached(current => current.filter(item => item.id !== file.id)); onPending(current => current.filter(item => item.id !== file.id)); setSaved(false); }} />}
          </View>
        ))}
        {closed || alumni ? null : (
          <>
            <Text variant="caption">Up to 5, 10 MB each. PDF, images, text, or Office documents.{files.some(file => !file.attached) ? " New files are added when you submit." : ""}</Text>
            <Button variant="secondary" size="compact" icon={Plus} testID="task-add-files" label={uploading ? "Uploading…" : "Add files"} loading={uploading} disabled={submit.isPending || files.length >= MAX_TASK_FILES} accessibilityHint={`Upload files for ${task.title} in ${clubName}`} onPress={() => { void addFiles(); }} />
            {uploading ? <Text variant="caption" accessibilityLiveRegion="polite">Uploading securely… Keep this page open.</Text> : null}
          </>
        )}
      </View>

      {own.feedback ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><CheckCircle2 size={16} color={colors.foreground} /><Text variant="smallStrong">{own.revisionRequestedAt ? "Revisions requested" : "Review feedback"}</Text></View>
          <Text variant="body" selectable>{own.feedback}</Text>
        </View>
      ) : null}
      {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
      {stale && !closed ? <Text testID="task-stale" variant="small" color={colors.destructive} accessibilityRole="alert">{STALE_MESSAGE}</Text> : null}
      {saved ? <Text testID="task-saved" variant="small" color={colors.success} accessibilityLiveRegion="polite">Your submission was saved.</Text> : null}
      {alumni ? <AlumniBanner action="task" /> : closed ? null : (
        <Button full size="large" testID="task-submit" loading={submit.isPending} disabled={uploading} label={submit.isPending ? "Submitting…" : own.submittedAt ? (own.revisionRequestedAt ? "Resubmit revisions" : "Update submission") : "Submit work"} onPress={() => {
          // The server takes only a full http(s) address; a typed "docs.google.com/…" is completed here instead of refused.
          const address = taskLink(link);
          if (address === null) { haptics.error(); setError("Enter a full web address, like https://docs.google.com/…"); return; }
          const problem = missing(address);
          if (problem) { haptics.error(); setError(problem); return; }
          submit.mutate({ address, sent: files.map(file => file.id) });
        }} />
      )}
    </Card>
  );
}

export default function TaskScreen() {
  const { colors } = useTheme();
  const top = useHeaderInset();
  const { assignmentId, clubId } = useLocalSearchParams<{ assignmentId: string; clubId?: string }>();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const memberships = (me.data?.memberships ?? []).filter(membership => !membership.alumniSince && (!clubId || membership.clubId === clubId));
  const workspaces = useTaskWorkspaces(memberships);
  const client = useQueryClient();
  const viewed = useRef<string | null>(null);
  // A saved submission reloads the task with a new revision, which remounts the form: the confirmation is held here.
  const [savedId, setSavedId] = useState<string | null>(null);
  const [staleId, setStaleId] = useState<string | null>(null);
  const draft = useRef<Draft | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const now = Date.now();

  const index = workspaces.findIndex(query => ownTasks(query.data).some(({ own }) => own.id === assignmentId));
  const found = index >= 0 ? ownTasks(workspaces[index]!.data).find(({ own }) => own.id === assignmentId) : undefined;
  const workspace = index >= 0 ? workspaces[index]!.data : undefined;
  const clubName = index >= 0 ? memberships[index]!.club.name : "Your club";
  const loading = me.isPending || (!found && workspaces.some(query => query.isPending));
  // A failed background refetch keeps the loaded task (and the form being typed in) on screen; only a first load that failed is an error.
  const failure = (me.isError && !me.data ? me.error : null) ?? (!found ? workspaces.find(query => query.isError && !query.data)?.error : null);
  const outdated = (me.isError && !!me.data) || (!!found && workspaces[index]!.isError);
  const refresh = () => Promise.all([me.refetch(), ...workspaces.map(query => query.refetch())]);
  const pull = usePullRefresh(refresh);

  // Opening a task marks it viewed, as the web's task sheet does.
  useEffect(() => {
    if (!found || found.own.viewedAt || viewed.current === found.own.id) return;
    viewed.current = found.own.id;
    api.post("tasks.view", { assignmentId: found.own.id }).then(() => {
      client.invalidateQueries({ queryKey: ["home.view", null] });
      client.invalidateQueries({ queryKey: ["home.taskNotifications", null] });
    }).catch(() => { /* viewing is best effort; the task still shows */ });
  }, [found, client]);

  const task = found?.task, own = found?.own;
  const links = task ? taskResources(task) : [];
  const children = task && workspace ? workspace.tasks.filter(child => child.projectId === task.id) : [];

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" refreshing={pull.refreshing} onRefresh={pull.onRefresh} testID="task-screen">
        {loading ? (
          <>
            <View style={{ gap: 10 }}><Skeleton width="50%" /><Skeleton width="85%" height={30} /><Skeleton width="40%" /></View>
            <Card style={{ gap: 10 }}><Skeleton width="35%" height={18} /><Skeleton /><Skeleton width="80%" /></Card>
            <Card style={{ gap: 10 }}><Skeleton width="45%" height={18} /><Skeleton height={90} /><Skeleton height={44} /></Card>
          </>
        ) : failure ? (
          <ErrorState message={errorMessage(failure, "Could not load tasks.")} offline={failure instanceof ApiError && failure.offline} onRetry={() => { void refresh(); }} />
        ) : !task || !own ? (
          <Card><EmptyState title="Task unavailable" body="This task is no longer assigned to you, or it was removed." /></Card>
        ) : (
          <>
            {outdated ? <Text variant="caption" accessibilityRole="alert" testID="task-refresh-failed">Couldn’t refresh this task. Showing what was last loaded.</Text> : null}
            <View style={{ gap: 8 }}>
              <Text variant="small">{clubName} · {task.kind === "PROJECT" ? "Project" : "Assignment"}</Text>
              <Text variant="display" accessibilityRole="header">{task.title}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><CalendarClock size={16} color={colors.mutedForeground} /><Text variant="small">Due {relativeDue(task.dueAt, now)}</Text></View>
                <Chip label={taskState(task, own, now)} tone={isSubmitted(own) ? "success" : isMissing(task, own, now) ? "error" : "neutral"} />
              </View>
              {task.project ? <Text variant="small">Project · {task.project.title}</Text> : null}
              {own.groupLabel ? <Text variant="smallStrong">Assigned group · {own.groupLabel}</Text> : null}
            </View>

            <Card style={{ gap: 8 }} testID="task-instructions">
              <Text variant="section" accessibilityRole="header">Instructions</Text>
              <Text variant="body" selectable color={task.description ? colors.foreground : colors.mutedForeground}>{task.description || "No additional instructions."}</Text>
              {links.length ? (
                <View accessibilityLabel="Task resources" style={{ marginTop: 4 }}>
                  {links.map((resource, position) => (
                    <View key={`${resource.url}-${position}`}>
                      <Divider />
                      <Press large accessibilityRole="link" accessibilityLabel={resource.label} accessibilityHint="Opens in the browser" onPress={() => { openExternal(resource.url); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: TARGET + 4 }}>
                        <Text variant="body" style={{ flex: 1 }}>{resource.label}</Text>
                        <ArrowUpRight size={18} color={colors.mutedForeground} />
                      </Press>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>

            {task.kind === "TASK" ? <Submission key={`${own.id}-${own.revision}`} task={task} own={own} clubName={clubName} saved={savedId === own.id} onSaved={value => setSavedId(value ? own.id : null)}
              draft={draft.current} onDraft={value => { draft.current = value; }} stale={staleId === own.id} onStale={value => setStaleId(value ? own.id : null)}
              pending={pending?.id === own.id ? pending.files : []} onPending={update => setPending(current => ({ id: own.id, files: update(current?.id === own.id ? current.files : []) }))} /> : (
              <Card style={{ gap: 8 }}>
                <Text variant="section" accessibilityRole="header">Related tasks</Text>
                {children.length ? children.map(child => <Text key={child.id} variant="body">{child.title} · <Text variant="small">{child.dueAt ? `Due ${taskDate(child.dueAt)}` : "No due date"}</Text></Text>) : <Text variant="small">New tasks will appear here.</Text>}
              </Card>
            )}
          </>
        )}
      </ScreenScroll>
      <Header title="Task" back />
    </View>
  );
}
