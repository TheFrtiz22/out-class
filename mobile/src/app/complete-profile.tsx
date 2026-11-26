import { PHONE_INVALID_MESSAGE, normalizePhone } from "@outclass/shared/phone";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilterChip } from "~/components/explore/parts";
import { Field, type FieldRef } from "~/components/field";
import { TermsCheckbox } from "~/components/terms-checkbox";
import { Text } from "~/components/text";
import { Button, Skeleton, useScreenGutters } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { useAuth } from "~/lib/auth";
import { haptics } from "~/lib/haptics";
import { config } from "~/lib/config";
import { useApiQuery } from "~/lib/query";
import { PASSWORD_NOT_SAVED_NOTICE, nameIssue, passwordNotSavedFor, termsAcceptedFor, type SignupOptions } from "~/lib/signup";
import { useTheme } from "~/lib/theme";

type Errors = Partial<Record<"firstName" | "lastName" | "major" | "gradYear" | "phone" | "terms" | "form", string>>;

const metadataName = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 50) : "";

/**
 * The last step of a new account, and the step any signed-in account without a student profile
 * is sent to (the web does the same at /signup). Saves through the web's own profile action.
 */
export default function CompleteProfile() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const gutters = useScreenGutters(24);
  const queryClient = useQueryClient();
  const { session, signOut } = useAuth();
  const metadata = session?.user.user_metadata ?? {};
  const options = useApiQuery<SignupOptions>("auth.signupOptions", undefined, { anonymous: true, staleTime: 10 * 60_000 });
  const termsRequired = options.data?.termsRequired === true;

  const [firstName, setFirstName] = useState(() => metadataName(metadata.first_name));
  const [lastName, setLastName] = useState(() => metadataName(metadata.last_name));
  const [major, setMajor] = useState("");
  const [gradYear, setGradYear] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(() => termsAcceptedFor(session?.user.email));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [passwordNotSaved] = useState(() => passwordNotSavedFor(session?.user.email));
  const lastRef = useRef<FieldRef>(null), majorRef = useRef<FieldRef>(null), phoneRef = useRef<FieldRef>(null);

  async function save() {
    if (busy) return;
    let normalizedPhone = "";
    try { normalizedPhone = normalizePhone(phone); } catch { /* reported below */ }
    const found: Errors = {
      firstName: nameIssue(firstName, "First") ?? undefined,
      lastName: nameIssue(lastName, "Last") ?? undefined,
      major: major.trim() ? undefined : "Add your major, or your intended major.",
      gradYear: gradYear ? undefined : options.isPending ? "Graduation years are still loading. Try again in a moment." : "Choose your graduation year.",
      phone: normalizedPhone ? undefined : phone.trim() ? PHONE_INVALID_MESSAGE : "Add a phone number. Clubs call applicants they accept.",
      terms: termsRequired && !acceptTerms ? "Accept the Terms and Privacy Policy to continue." : undefined,
    };
    if (Object.values(found).some(Boolean)) { haptics.error(); setErrors(found); return; }
    setBusy(true); setErrors({});
    try {
      if (termsRequired) await api.post("terms.accept");
      await api.post("profile.create", { firstName: firstName.trim(), lastName: lastName.trim(), computingId: (session?.user.email ?? "").split("@")[0], major: major.trim(), gradYear: Number(gradYear), phone: normalizedPhone });
      haptics.confirm();
      // The navigation gate leaves this screen once `me` has a profile.
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      haptics.error();
      setErrors({ form: errorMessage(error) });
    } finally { setBusy(false); }
  }


  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, ...gutters.padding, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 24 }}>
        <View style={{ gap: 6 }}>
          <Text variant="eyebrow">Almost done</Text>
          <Text variant="display" accessibilityRole="header">Finish your profile</Text>
          <Text variant="body" color={colors.mutedForeground}>Clubs see this when you apply. You can add more later from your profile.</Text>
        </View>
        {passwordNotSaved ? (
          <View accessibilityRole="alert" style={{ gap: 8, padding: 14, borderRadius: 14, backgroundColor: colors.muted }}>
            <Text variant="small">{PASSWORD_NOT_SAVED_NOTICE}</Text>
            <Button variant="secondary" size="compact" label="Reset password" testID="profile-reset-password" onPress={() => { WebBrowser.openBrowserAsync(`${config.apiUrl}/forgot-password`).catch(() => {}); }} />
          </View>
        ) : null}
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="First name" testID="profile-first" value={firstName} onChangeText={setFirstName} error={errors.firstName} autoComplete="given-name" textContentType="givenName" autoCapitalize="words" returnKeyType="next" maxLength={50} onSubmitEditing={() => lastRef.current?.focus()} />
            </View>
            <View style={{ flex: 1 }}>
              <Field ref={lastRef} label="Last name" testID="profile-last" value={lastName} onChangeText={setLastName} error={errors.lastName} autoComplete="family-name" textContentType="familyName" autoCapitalize="words" returnKeyType="next" maxLength={50} onSubmitEditing={() => majorRef.current?.focus()} />
            </View>
          </View>
          <Field ref={majorRef} label="Major or intended major" testID="profile-major" value={major} onChangeText={setMajor} error={errors.major} autoCapitalize="words" returnKeyType="next" maxLength={200} onSubmitEditing={() => phoneRef.current?.focus()} />
          <View style={{ gap: 8 }}>
            <Text variant="smallStrong">Graduation year</Text>
            {options.isError ? (
              <View style={{ gap: 8 }}>
                <Text variant="small" color={colors.destructive}>{errorMessage(options.error)}</Text>
                <Button variant="secondary" size="compact" label="Try again" onPress={() => options.refetch()} />
              </View>
            ) : options.isPending ? (
              <View accessibilityLabel="Loading graduation years" accessibilityRole="progressbar" testID="profile-years-loading" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[0, 1, 2, 3].map(index => <Skeleton key={index} width={56} height={36} radius={18} />)}
              </View>
            ) : (
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(options.data?.graduationYears ?? []).map(year => (
                  <FilterChip key={year} testID={`profile-year-${year}`} label={year} selected={gradYear === year} onPress={() => setGradYear(year)} />
                ))}
              </View>
            )}
            {errors.gradYear ? <Text variant="caption" color={colors.destructive} accessibilityRole="alert">{errors.gradYear}</Text> : null}
          </View>
          <Field ref={phoneRef} label="Phone" testID="profile-phone" value={phone} onChangeText={setPhone} error={errors.phone} hint="Clubs call applicants they accept." keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={40} returnKeyType="done" />
          {termsRequired ? <TermsCheckbox testID="profile-terms" checked={acceptTerms} onChange={setAcceptTerms} error={errors.terms} /> : null}
          {errors.form ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" accessibilityLiveRegion="polite">{errors.form}</Text> : null}
          <Button full size="large" label="Finish" testID="profile-submit" loading={busy} onPress={save} />
          <Button full variant="ghost" label="Sign out" testID="profile-sign-out" onPress={() => { signOut().catch(() => {}); }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
