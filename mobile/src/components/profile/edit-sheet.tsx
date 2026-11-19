import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView, Switch, View, useWindowDimensions } from "react-native";
import { Field } from "~/components/field";
import { Camera, FileText, ImagePlus, Plus, Trash2, Upload } from "~/components/icons";
import { FilterChips } from "~/components/inbox/filter-chips";
import { PrivateImage, photoParams } from "~/components/private-image";
import { genderValues, graduationYearOptions, initials, isStoragePath, numberProblem, pronounValues, scholarLabels, scholarPrograms, sectionOrder, sectionProblem, sectionPayload, sectionSnapshot, sectionTitles, toggleScholar } from "~/components/profile/model";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Divider, TARGET } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { fonts, useTheme } from "~/lib/theme";
import type { FullStudentProfile, ProfileSectionId } from "~/lib/types";

type SaveResult = { profile: FullStudentProfile } | { error: string };
type Upload = { uri: string; name: string; type: string };

/** The web's sole upload path (actions/storage.ts): multipart `kind` + `file`, answered with a stored reference. */
async function uploadProfileFile(kind: "resume" | "headshot", file: Upload): Promise<string> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  const { reference } = await api.post<{ reference: string }>("profile.upload", form);
  return reference;
}

function SwitchRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET }}>
      <Text variant="body" style={{ flex: 1 }}>{label}</Text>
      <Switch accessibilityLabel={label} accessibilityRole="switch" value={value} disabled={disabled} onValueChange={next => { haptics.tick(); onChange(next); }} trackColor={{ true: colors.primary, false: colors.muted }} ios_backgroundColor={colors.muted} />
    </View>
  );
}

const numberText = (value: number | null | undefined) => (value == null ? "" : String(value));
const parseNumber = (text: string): number | null => { const value = text.trim() === "" ? null : Number(text.replace(",", ".")); return value === null || Number.isFinite(value) ? value : null; };

/**
 * "Edit profile": one sheet that switches between the web's five sections. Each section saves
 * through `profile.updateSection` with the section as it was loaded (`expected`), so a change
 * made on another device is never overwritten; the server's own message is shown when it refuses.
 */
export function EditProfileSheet({ open, onClose, profile, initialSection = "identity", onSaved, onLocalPhoto }: { open: boolean; onClose: () => void; profile: FullStudentProfile; initialSection?: ProfileSectionId; onSaved: (profile: FullStudentProfile) => void; onLocalPhoto?: (uri: string | null) => void }) {
  const { colors, radius } = useTheme();
  const { height } = useWindowDimensions();
  const client = useQueryClient();
  const [section, setSection] = useState<ProfileSectionId>(initialSection);
  const [draft, setDraft] = useState<FullStudentProfile>(profile);
  const [saved, setSaved] = useState<FullStudentProfile>(profile);
  const expected = useRef(sectionSnapshot(profile, initialSection));
  const [busy, setBusy] = useState<"" | "save" | "upload">("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [scholarYes, setScholarYes] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [keyboard, setKeyboard] = useState(0);

  // The sheet sits on the keyboard, so the form scrolls in what is left rather than pushing the sheet off the top of a small phone.
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", event => setKeyboard(event.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Each opening starts from the saved profile, on the section asked for.
  useEffect(() => {
    if (!open) return;
    setSection(initialSection); setDraft(profile); setSaved(profile); setError(""); setStatus(""); setPhotoPreview(null);
    expected.current = sectionSnapshot(profile, initialSection);
    setScholarYes(!!profile.scholarStatus?.selections?.some(value => value !== "NOT_APPLICABLE"));
    setNumbers({ gpa: numberText(profile.gpa), satScore: numberText(profile.satScore), actScore: numberText(profile.actScore), actEnglish: numberText(profile.actEnglish), actMath: numberText(profile.actMath), actReading: numberText(profile.actReading), actScience: numberText(profile.actScience) });
    // Only the open edge re-seeds the form; a background refetch must not replace what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = sectionSnapshot(draft, section) !== sectionSnapshot(saved, section);
  const patch = (changes: Partial<FullStudentProfile>) => { setStatus(""); setDraft(current => ({ ...current, ...changes })); };

  /** Saves the open section. Resolves with the saved profile, or null when something is still unsaved. */
  async function save(value: FullStudentProfile = draft): Promise<FullStudentProfile | null> {
    const typed = section === "education" ? numberProblem(numbers) : null;
    if (typed) { setError(typed); haptics.error(); return null; }
    if (sectionSnapshot(value, section) === sectionSnapshot(saved, section)) return saved;
    const problem = section === "education" && scholarYes && !value.scholarStatus ? "Choose at least one scholar program." : sectionProblem(value, section);
    if (problem) { setError(problem); haptics.error(); return null; }
    setBusy("save"); setError(""); setStatus("");
    try {
      // The mobile route caps `expected` at 200 characters, and an education or experience snapshot is longer, so
      // sending it would refuse every such save. Without it the server saves without the other-device check.
      const input = sectionPayload(value, saved, section);
      const result = await api.post<SaveResult>("profile.updateSection", expected.current.length <= 200 ? { input, expected: expected.current } : { input });
      if ("error" in result) throw new Error(result.error || "Unable to save.");
      expected.current = sectionSnapshot(result.profile, section);
      setSaved(result.profile); setDraft(result.profile);
      client.setQueryData(["profile", null], { profile: result.profile });
      client.invalidateQueries({ queryKey: ["me", null] });
      // Home and Applications warn about a missing phone number; refresh them so the warning clears.
      client.invalidateQueries({ queryKey: ["home.view"] });
      client.invalidateQueries({ queryKey: ["applications.view"] });
      onSaved(result.profile);
      setStatus("Profile changes saved."); haptics.confirm();
      return result.profile;
    } catch (reason) {
      // The server's wording, including "This profile section changed in another tab. Reopen it to compare. Your text is retained."
      setError(reason instanceof Error && !(reason.name === "ApiError") ? reason.message : errorMessage(reason, "Your changes could not be saved. Please try again."));
      haptics.error();
      return null;
    } finally { setBusy(""); }
  }

  async function switchSection(next: ProfileSectionId) {
    if (next === section || busy) return;
    const current = await save();
    if (!current) return;
    setError(""); setStatus("");
    expected.current = sectionSnapshot(current, next);
    setSection(next);
  }
  async function done() { if (await save()) onClose(); }

  async function pickPhoto(source: "camera" | "library") {
    setError(""); setStatus("");
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError("Camera access is off for OutClass. You can choose a photo from your library instead."); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const type = asset.mimeType === "image/png" || asset.mimeType === "image/webp" ? asset.mimeType : "image/jpeg";
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) { setError("Choose a JPEG, PNG or WebP image up to 5 MB."); return; }
      setBusy("upload");
      const reference = await uploadProfileFile("headshot", { uri: asset.uri, type, name: `headshot.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"}` });
      setPhotoPreview(asset.uri);
      const next = { ...draft, headshotUrl: reference };
      setDraft(next);
      setBusy("");
      // The web asks for "Save changes to update your photo"; here the cropped photo is saved straight away.
      if (await save(next)) onLocalPhoto?.(asset.uri);
    } catch (reason) {
      setError(errorMessage(reason, "Upload failed. Your saved profile has not changed.")); haptics.error();
    } finally { setBusy(current => (current === "upload" ? "" : current)); }
  }

  async function pickResume() {
    setError(""); setStatus("");
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      if (asset.size && asset.size > 10 * 1024 * 1024) { setError("Choose a PDF up to 10 MB"); return; }
      setBusy("upload");
      const reference = await uploadProfileFile("resume", { uri: asset.uri, type: "application/pdf", name: "resume.pdf" }); // The name isn't kept, and a long or unusual one fails the server's name check.
      const next = { ...draft, resumeUrl: reference };
      setDraft(next);
      setBusy("");
      await save(next); // "The document attachment saves automatically."
    } catch (reason) {
      setError(errorMessage(reason, "Upload failed. Your saved profile has not changed.")); haptics.error();
    } finally { setBusy(current => (current === "upload" ? "" : current)); }
  }

  const disabled = !!busy;
  const scholarship = draft.scholarStatus;
  const numberField = (key: "gpa" | "satScore" | "actScore" | "actEnglish" | "actMath" | "actReading" | "actScience", label: string) => (
    <View style={{ flexBasis: "47%", flexGrow: 1 }}>
      <Field label={label} testID={`profile-${key}`} editable={!disabled} keyboardType={key === "gpa" ? "decimal-pad" : "number-pad"} value={numbers[key] ?? ""}
        onChangeText={text => { setNumbers(current => ({ ...current, [key]: text })); patch({ [key]: parseNumber(text) } as Partial<FullStudentProfile>); }} />
    </View>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Edit profile" dismissible={!busy && !dirty} testID="profile-edit-sheet">
      <View style={{ gap: 12 }}>
        <Text variant="small" style={{ marginTop: -6 }}>Choose a section. Changes save when you switch sections or tap Done.</Text>
        <FilterChips label="Profile section" testID="profile-section" value={section} onChange={switchSection} options={sectionOrder.map(id => ({ value: id, label: sectionTitles[id] }))} />
        {error ? <Text testID="profile-edit-error" variant="small" color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
        <ScrollView style={{ maxHeight: keyboard ? Math.max(140, Math.min(height * 0.5, height - keyboard - 320)) : height * 0.5 }} contentContainerStyle={{ gap: 14, paddingBottom: 6 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {section === "identity" ? (
            <>
              <Field label="First name" testID="profile-first-name" editable={!disabled} value={draft.firstName} onChangeText={firstName => patch({ firstName })} autoComplete="given-name" textContentType="givenName" />
              <Field label="Last name" testID="profile-last-name" editable={!disabled} value={draft.lastName} onChangeText={lastName => patch({ lastName })} autoComplete="family-name" textContentType="familyName" />
              <View style={{ gap: 10 }}>
                <Text variant="smallStrong">Profile photo (JPEG, PNG or WebP, up to 5 MB)</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View accessible={false} style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
                    {photoPreview && draft.headshotUrl ? <Image source={{ uri: photoPreview }} style={{ width: 64, height: 64 }} contentFit="cover" />
                      : <PrivateImage own kind="profile-photos" params={photoParams(draft.headshotUrl)} style={{ width: 64, height: 64 }} fallback={<Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.sansMedium, fontSize: 22, lineHeight: 28, color: colors.primary }}>{initials(draft)}</Text>} />}
                  </View>
                  <Text variant="small" style={{ flex: 1 }}>{draft.headshotUrl ? "A photo is on your profile." : "No photo added."}</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Button variant="secondary" size="compact" icon={Camera} testID="profile-photo-camera" label="Take photo" disabled={disabled} onPress={() => pickPhoto("camera")} />
                  <Button variant="secondary" size="compact" icon={ImagePlus} testID="profile-photo-library" label="Choose photo" loading={busy === "upload"} disabled={disabled} onPress={() => pickPhoto("library")} />
                  {draft.headshotUrl ? <Button variant="ghost" size="compact" testID="profile-photo-remove" label="Remove photo" disabled={disabled} onPress={() => { setPhotoPreview(null); onLocalPhoto?.(null); patch({ headshotUrl: null }); }} /> : null}
                </View>
              </View>
              <Text variant="caption">Your computing ID is managed by your university account.</Text>
            </>
          ) : null}

          {section === "education" ? (
            <>
              <Field label="Major / intended major" testID="profile-major" editable={!disabled} value={draft.major ?? ""} onChangeText={major => patch({ major })} />
              <View style={{ gap: 6 }}>
                <Text variant="smallStrong">Graduation year</Text>
                <FilterChips label="Graduation year" testID="profile-year" value={String(draft.gradYear ?? "")} onChange={value => patch({ gradYear: Number(value) })} options={graduationYearOptions(saved.gradYear).map(year => ({ value: String(year), label: String(year) }))} />
              </View>
              <Field label="High school (optional)" editable={!disabled} value={draft.highSchool ?? ""} onChangeText={highSchool => patch({ highSchool })} />
              {([["gender", "Gender", genderValues], ["pronouns", "Pronouns", pronounValues]] as const).map(([key, label, values]) => (
                <View key={key} style={{ gap: 6 }}>
                  <Text variant="smallStrong">{label}</Text>
                  <FilterChips label={label} value={draft[key] ?? ""} onChange={value => patch({ [key]: value || null } as Partial<FullStudentProfile>)} options={[{ value: "", label: "Not provided" }, ...values.map(value => ({ value, label: value }))]} />
                </View>
              ))}
              <Text variant="caption">Gender is shared with recruitment reviewers only when explicitly enabled for the round. Pronouns and high school stay on your personal profile.</Text>
              <SwitchRow label="Transfer student" value={!!draft.transferStudent} disabled={disabled} onChange={transferStudent => patch({ transferStudent })} />
              <View style={{ gap: 6 }}>
                <Text variant="smallStrong">Are you a scholar?</Text>
                <FilterChips label="Are you a scholar?" value={scholarYes ? "yes" : draft.scholarStatus ? "no" : ""} onChange={value => { setScholarYes(value === "yes"); patch({ scholarStatus: value === "no" ? { selections: ["NOT_APPLICABLE"], other: "" } : null }); }} options={[{ value: "", label: "Not provided" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                {scholarYes ? ([...scholarPrograms, "OTHER"] as const).map(selection => (
                  <SwitchRow key={selection} label={scholarLabels[selection]!} value={!!scholarship?.selections?.includes(selection)} disabled={disabled} onChange={checked => patch({ scholarStatus: toggleScholar(draft.scholarStatus, selection, checked) })} />
                )) : null}
                {scholarYes && scholarship?.selections.includes("OTHER") ? <Field label="Scholarship name" accessibilityLabel="Other scholarship name" maxLength={200} editable={!disabled} value={scholarship.other || ""} onChangeText={other => patch({ scholarStatus: { ...scholarship, other } })} /> : null}
                <Text variant="caption">Clubs you apply to may see this.</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {numberField("gpa", "GPA out of 4.0 (optional)")}
                {numberField("satScore", "SAT (optional)")}
                {numberField("actScore", "ACT composite (optional)")}
                {numberField("actEnglish", "ACT English (optional)")}
                {numberField("actMath", "ACT Math (optional)")}
                {numberField("actReading", "ACT Reading (optional)")}
                {numberField("actScience", "ACT Science (optional)")}
              </View>
            </>
          ) : null}

          {section === "experience" ? (
            <>
              <Text variant="small">Include internships, research, projects, or leadership. Add your most recent work first; dates are displayed as you enter them.</Text>
              {draft.experiences.map((experience, index) => (
                <View key={index} style={{ gap: 10 }}>
                  {index ? <Divider /> : null}
                  <Text variant="smallStrong" accessibilityRole="header">Experience {index + 1}</Text>
                  {([["title", "Role or project"], ["subtitle", "Organization / context"], ["period", "Dates"]] as const).map(([key, label]) => (
                    <Field key={key} label={label} testID={`profile-experience-${index}-${key}`} editable={!disabled} value={experience[key]} onChangeText={text => patch({ experiences: draft.experiences.map((item, position) => (position === index ? { ...item, [key]: text } : item)) })} />
                  ))}
                  <Button variant="ghost" size="compact" icon={Trash2} label={`Remove experience ${index + 1}`} disabled={disabled} onPress={() => patch({ experiences: draft.experiences.filter((_, position) => position !== index) })} />
                </View>
              ))}
              <Button variant="secondary" icon={Plus} testID="profile-experience-add" label="Add experience" disabled={disabled || draft.experiences.length >= 50} onPress={() => patch({ experiences: [...draft.experiences, { title: "", subtitle: "", period: "" }] })} />
            </>
          ) : null}

          {section === "contact" ? (
            <Field label="Phone number" testID="profile-phone" editable={!disabled} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="(434) 555-0123" value={draft.phone ?? ""} onChangeText={phone => patch({ phone })}
              hint="Required to apply. Clubs call applicants they accept; only a club that accepts you sees it." />
          ) : null}

          {section === "links" ? (
            <>
              <Field label="LinkedIn URL" testID="profile-linkedin" editable={!disabled} keyboardType="url" autoCapitalize="none" autoCorrect={false} value={draft.linkedinUrl ?? ""} onChangeText={linkedinUrl => patch({ linkedinUrl })} />
              {isStoragePath(draft.resumeUrl) ? (
                <View style={{ gap: 8 }}>
                  <Text variant="smallStrong">Résumé</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
                    <FileText size={20} color={colors.foreground} />
                    <Text testID="profile-resume-attached" variant="body" style={{ flex: 1 }}>PDF attached</Text>
                    <Button variant="ghost" size="compact" testID="profile-resume-remove" label="Remove" accessibilityHint="Removes the attached résumé" disabled={disabled} onPress={() => patch({ resumeUrl: "" })} />
                  </View>
                </View>
              ) : (
                <Field label="Résumé URL" testID="profile-resume-url" editable={!disabled} keyboardType="url" autoCapitalize="none" autoCorrect={false} value={draft.resumeUrl ?? ""} onChangeText={resumeUrl => patch({ resumeUrl })} />
              )}
              <View style={{ gap: 8 }}>
                <Text variant="smallStrong">Or upload a résumé (PDF, up to 10 MB)</Text>
                <Button variant="secondary" icon={Upload} testID="profile-resume-upload" label="Choose PDF" loading={busy === "upload"} disabled={disabled} onPress={pickResume} />
              </View>
              <Text variant="small">The document attachment saves automatically. Clear the résumé URL to remove the attachment. LinkedIn and résumé details are not imported automatically.</Text>
            </>
          ) : null}
        </ScrollView>
        {status ? <Text testID="profile-edit-status" variant="small" accessibilityLiveRegion="polite">{status}</Text> : null}
        {(dirty || error) && !busy ? <Button variant="ghost" size="compact" testID="profile-edit-discard" label="Discard changes" onPress={onClose} /> : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Button full variant="secondary" testID="profile-edit-save" label="Save" disabled={disabled || !dirty} onPress={() => { save(); }} /></View>
          <View style={{ flex: 1 }}><Button full testID="profile-edit-done" label={busy ? "Working…" : "Done"} loading={busy === "save"} disabled={disabled} onPress={done} /></View>
        </View>
      </View>
    </Sheet>
  );
}
