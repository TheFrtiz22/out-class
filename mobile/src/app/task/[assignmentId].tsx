import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AlumniBanner, useIsAlumni } from "~/components/alumni-banner";
import { Field } from "~/components/field";
import { Header, useHeaderInset } from "~/components/header";
import { ArrowUpRight, CalendarClock, CheckCircle2, Download, ExternalLink, FilePenLine } from "~/components/icons";
import { isClosed, ownTasks, relativeDue, taskDate, taskResources, taskState, useTaskWorkspaces } from "~/components/tasks/presentation";
import { Text } from "~/components/text";
import { Button, Card, Chip, Divider, EmptyState, ErrorState, Press, ScreenScroll, Skeleton, TARGET } from "~/components/ui";
import { api, ApiError, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { openExternal, openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { ClubTask, Me, TaskAssignment } from "~/lib/types";

/** The web's submission form (components/club-tasks.tsx `Submission`): written response, link, files. */
function Submission({ task, own, clubName, saved, onSaved }: { task: ClubTask; own: TaskAssignment; clubName: string; saved: boolean; onSaved: (saved: boolean) => void }) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const alumni = useIsAlumni();
  const closed = isClosed(task, own);
  const [text, setText] = useState(own.text ?? "");
  const [link, setLink] = useState(own.link ?? "");
  const [error, setError] = useState("");
  const setSaved = onSaved;
  const required = (type: string) => (task.requirements.includes(type) ? "Required" : "Optional");

  const submit = useMutation({
    // Files already attached on the web stay attached; the server checks every field and the revision.
    mutationFn: () => api.post("tasks.submit", { assignmentId: own.id, revision: own.revision, text: text.trim(), link: link.trim(), fileIds: own.files.map(file => file.id) }),
    onMutate: () => { setError(""); setSaved(false); },
    onSuccess: () => {
      haptics.confirm(); setSaved(true);
      client.invalidateQueries({ queryKey: ["tasks.workspace"] });
      client.invalidateQueries({ queryKey: ["home.view", null] });
      client.invalidateQueries({ queryKey: ["home.taskNotifications", null] });
    },
    onError: reason => { haptics.error(); setError(errorMessage(reason, "Could not save. Please try again.")); },
  });
  const download = useMutation({
    mutationFn: (fileId: string) => api.get<{ url: string }>("tasks.file", { fileId }),
    onMutate: () => setError(""),
    onSuccess: ({ url }) => { openExternal(url); },
    onError: reason => { haptics.error(); setError(errorMessage(reason, "Download failed.")); },
  });

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
        Required: {task.requirements.length ? task.requirements.map(value => value.toLowerCase()).join(" + ") : "text, a link, or a file"}. {closed ? "This submission is closed." : "Submit when ready to share it."}
      </Text>
      <Field testID="task-text" label={`Written response · ${required("TEXT")}`} multiline maxLength={30000} editable={!closed && !alumni && !submit.isPending} value={text} onChangeText={value => { setText(value); setSaved(false); }} />
      <Field testID="task-link" label={`Website or document link · ${required("LINK")}`} maxLength={2000} editable={!closed && !alumni && !submit.isPending} value={link} onChangeText={value => { setLink(value); setSaved(false); }} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />

      <View style={{ gap: 6 }}>
        <Text variant="smallStrong">File upload · {required("FILE")}</Text>
        {own.files.map(file => (
          <View key={file.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: TARGET }}>
            <Text variant="small" color={colors.foreground} style={{ flex: 1 }}>{file.name} · {Math.ceil(file.size / 1024)} KB</Text>
            <Button variant="ghost" size="compact" icon={Download} label="Download" accessibilityHint={file.name} loading={download.isPending && download.variables === file.id} onPress={() => download.mutate(file.id)} />
          </View>
        ))}
        {closed || alumni ? null : (
          <>
            <Text variant="caption">Up to 5, 10 MB each. PDF, images, text, or Office documents. Files are added on the web for now.</Text>
            <Button variant="secondary" size="compact" icon={ExternalLink} testID="task-open-web" label="Open on web" accessibilityHint={`Upload files for ${task.title} in ${clubName}`} onPress={() => { openOnWeb(`/club/${task.clubId}/workspace?section=tasks&taskView=mine&taskId=${task.id}`); }} />
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
      {saved ? <Text testID="task-saved" variant="small" color={colors.success} accessibilityLiveRegion="polite">Your submission was saved.</Text> : null}
      {alumni ? <AlumniBanner action="task" /> : closed ? null : (
        <Button full size="large" testID="task-submit" loading={submit.isPending} label={submit.isPending ? "Submitting…" : own.submittedAt ? (own.revisionRequestedAt ? "Resubmit revisions" : "Update submission") : "Submit work"} onPress={() => submit.mutate()} />
      )}
    </Card>
  );
}

export default function TaskScreen() {
  const { colors } = useTheme();
  const top = useHeaderInset();
  const { assignmentId, clubId } = useLocalSearchParams<{ assignmentId: string; clubId?: string }>();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const memberships = (me.data?.memberships ?? []).filter(membership => !clubId || membership.clubId === clubId);
  const workspaces = useTaskWorkspaces(memberships);
  const client = useQueryClient();
  const viewed = useRef<string | null>(null);
  // A saved submission reloads the task with a new revision, which remounts the form: the confirmation is held here.
  const [savedId, setSavedId] = useState<string | null>(null);
  const now = Date.now();

  const index = workspaces.findIndex(query => ownTasks(query.data).some(({ own }) => own.id === assignmentId));
  const found = index >= 0 ? ownTasks(workspaces[index]!.data).find(({ own }) => own.id === assignmentId) : undefined;
  const workspace = index >= 0 ? workspaces[index]!.data : undefined;
  const clubName = index >= 0 ? memberships[index]!.club.name : "Your club";
  const loading = me.isPending || (!found && workspaces.some(query => query.isPending));
  const failure = me.error ?? (!found ? workspaces.find(query => query.isError)?.error : null);
  const refresh = () => { me.refetch(); workspaces.forEach(query => { query.refetch(); }); };

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
      <ScreenScroll top={top} automaticallyAdjustKeyboardInsets refreshing={workspaces.some(query => query.isRefetching)} onRefresh={refresh} testID="task-screen">
        {loading ? (
          <>
            <View style={{ gap: 10 }}><Skeleton width="50%" /><Skeleton width="85%" height={30} /><Skeleton width="40%" /></View>
            <Card style={{ gap: 10 }}><Skeleton width="35%" height={18} /><Skeleton /><Skeleton width="80%" /></Card>
            <Card style={{ gap: 10 }}><Skeleton width="45%" height={18} /><Skeleton height={90} /><Skeleton height={44} /></Card>
          </>
        ) : failure ? (
          <ErrorState message={errorMessage(failure, "Could not load tasks.")} offline={failure instanceof ApiError && failure.offline} onRetry={refresh} />
        ) : !task || !own ? (
          <Card><EmptyState title="Task unavailable" body="This task is no longer assigned to you, or it was removed." /></Card>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Text variant="small">{clubName} · {task.kind === "PROJECT" ? "Project" : "Assignment"}</Text>
              <Text variant="display" accessibilityRole="header">{task.title}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><CalendarClock size={16} color={colors.mutedForeground} /><Text variant="small">Due {relativeDue(task.dueAt, now)}</Text></View>
                <Chip label={taskState(task, own, now)} tone={own.reviewedAt || own.submittedAt ? "success" : task.dueAt && +new Date(task.dueAt) < now ? "error" : "neutral"} />
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

            {task.kind === "TASK" ? <Submission key={`${own.id}-${own.revision}`} task={task} own={own} clubName={clubName} saved={savedId === own.id} onSaved={value => setSavedId(value ? own.id : null)} /> : (
              <Card style={{ gap: 8 }}>
                <Text variant="section" accessibilityRole="header">Related tasks</Text>
                {children.length ? children.map(child => <Text key={child.id} variant="body">{child.title} · <Text variant="small">Due {taskDate(child.dueAt)}</Text></Text>) : <Text variant="small">New tasks will appear here.</Text>}
              </Card>
            )}
          </>
        )}
      </ScreenScroll>
      <Header title="Task" back />
    </View>
  );
}
