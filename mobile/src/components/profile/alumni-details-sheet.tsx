import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Keyboard, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { Field } from "~/components/field";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, TARGET, Toggle } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

/** components/alumni-details-fields.tsx: employer, role and the two alumni choices. */
export type AlumniDetails = { employer: string; role: string; showInAlumniList: boolean; shareEmployer: boolean };
export const POST_GRAD_TEXT_MAX = 100;
export const alumniDetailsDraft = (profile: { postGradEmployer?: string | null; postGradRole?: string | null; alumniDirectoryVisible?: boolean | null; alumniPlacementShare?: boolean | null } | null | undefined): AlumniDetails =>
  ({ employer: profile?.postGradEmployer ?? "", role: profile?.postGradRole ?? "", showInAlumniList: profile?.alumniDirectoryVisible ?? true, shareEmployer: profile?.alumniPlacementShare ?? true });
const alumniDetailsInput = (draft: AlumniDetails) => ({ employer: draft.employer.trim() || null, role: draft.role.trim() || null, showInAlumniList: draft.showInAlumniList, shareEmployer: draft.shareEmployer });

function Choice({ label, detail, value, onChange, disabled, testID }: { label: string; detail: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; testID: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: TARGET }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption">{detail}</Text>
      </View>
      <Toggle testID={testID} accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} />
    </View>
  );
}

/** Profile → After graduation → Edit (web: components/alumni-details-panel.tsx), saved with the web's saveAlumniDetails. */
export function AlumniDetailsSheet({ open, initial, onClose }: { open: boolean; initial: AlumniDetails; onClose: () => void }) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(open);
  const { height } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(0);
  // The sheet sits on the keyboard, so the fields scroll in what is left rather than going off the top of a small phone.
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", event => setKeyboard(event.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // Each opening starts from what is saved.
  if (open !== opened) { setOpened(open); if (open) { setDraft(initial); setError(""); } }
  const save = useMutation({
    mutationFn: (value: AlumniDetails) => api.post("graduation.details", alumniDetailsInput(value)),
    onMutate: () => setError(""),
    onSuccess: async () => {
      haptics.confirm();
      await Promise.all([client.invalidateQueries({ queryKey: ["profile", null] }), client.invalidateQueries({ queryKey: ["me", null] })]);
      onClose();
    },
    onError: reason => { haptics.error(); setError(errorMessage(reason, "We couldn’t save that. Try again.")); },
  });
  const set = (patch: Partial<AlumniDetails>) => setDraft(value => ({ ...value, ...patch }));
  const busy = save.isPending;
  return (
    <Sheet open={open} onClose={() => { if (!busy) onClose(); }} title="After graduation" testID="alumni-details-sheet">
      <View style={{ gap: 14 }}>
        <ScrollView testID="alumni-details-scroll" style={{ maxHeight: keyboard ? Math.max(140, Math.min(height * 0.55, height - keyboard - 300)) : height * 0.55 }}
          contentContainerStyle={{ gap: 14, paddingBottom: 6 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Field testID="alumni-employer" label="Employer (optional)" value={draft.employer} maxLength={POST_GRAD_TEXT_MAX} editable={!busy} autoComplete="organization" textContentType="organizationName" onChangeText={employer => set({ employer })} />
        <Field testID="alumni-role" label="Role or title (optional)" value={draft.role} maxLength={POST_GRAD_TEXT_MAX} editable={!busy} textContentType="jobTitle" onChangeText={role => set({ role })} />
        <Choice testID="alumni-share-employer" disabled={busy} value={draft.shareEmployer} onChange={shareEmployer => set({ shareEmployer })}
          label="Add the company name (not your name) to my clubs’ “Where members go” list"
          detail="Added once to each club, without your name. In a small club, members may be able to tell it’s you. You can turn this off." />
        <Choice testID="alumni-show-in-list" disabled={busy} value={draft.showInAlumniList} onChange={showInAlumniList => set({ showInAlumniList })}
          label="Show me in my clubs’ alumni list" detail="Current members see your name, email, employer, role and class year." />
        </ScrollView>
        {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
        <Button full size="large" testID="alumni-save" label={busy ? "Saving…" : "Save"} loading={busy} onPress={() => save.mutate(draft)} />
        <Button full variant="ghost" label="Cancel" disabled={busy} onPress={onClose} />
      </View>
    </Sheet>
  );
}
