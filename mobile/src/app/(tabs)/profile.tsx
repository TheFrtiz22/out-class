import { formatPhone } from "@outclass/shared/phone";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AlumniBanner, isAlumniProfile } from "~/components/alumni-banner";
import { Header, useHeaderInset } from "~/components/header";
import { Check, ChevronRight, ExternalLink, FileText, Linkedin, Pencil, Settings } from "~/components/icons";
import { EditProfileSheet } from "~/components/profile/edit-sheet";
import { initials, profileChecklist, resumeHref, safeProfileUrl, scholarSummary } from "~/components/profile/model";
import { Text } from "~/components/text";
import { Button, Card, Divider, ErrorState, IconButton, Row, ScreenScroll, Skeleton } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { openExternal, openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { fonts, useTheme } from "~/lib/theme";
import type { FullStudentProfile, ProfileSectionId } from "~/lib/types";

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Text variant="small">{label}</Text>
      <Text variant="small" color={useTheme().colors.foreground} style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

/** The web's condensed profile (components/views/unified-student-profile-view.tsx). */
export default function Profile() {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const query = useApiQuery<{ profile: FullStudentProfile | null }>("profile");
  const [editing, setEditing] = useState<ProfileSectionId | null>(null);
  const [lastSection, setLastSection] = useState<ProfileSectionId>("identity");
  // TODO(profile.media): the saved headshot cannot be shown yet (see the note below); a photo chosen in this session can.
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const profile = query.data?.profile ?? null;
  const edit = (section: ProfileSectionId) => { setLastSection(section); setEditing(section); };

  const checklist = profile ? profileChecklist(profile) : [];
  const completed = checklist.filter(item => item.complete).length;
  const allAdded = completed === checklist.length;
  const linkedin = safeProfileUrl(profile?.linkedinUrl);
  const resume = resumeHref(profile?.resumeUrl);
  const scholar = profile ? scholarSummary(profile.scholarStatus) : null;
  const afterGraduation = !!profile && (!!profile.graduationConfirmedAt || isAlumniProfile(profile));
  const work = profile ? [profile.postGradRole?.trim(), profile.postGradEmployer?.trim()].filter(Boolean).join(" at ") : "";

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll dock top={top} refreshing={query.isRefetching} onRefresh={() => query.refetch()} testID="profile-screen">
        {query.isPending ? (
          <View accessibilityLabel="Loading profile" accessibilityRole="progressbar" style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}><Skeleton width={80} height={80} radius={40} /><View style={{ flex: 1, gap: 10 }}><Skeleton width="70%" height={24} /><Skeleton width="55%" /><Skeleton width={120} height={36} radius={18} /></View></View>
            <Card style={{ gap: 10 }}><Skeleton width="35%" height={18} /><Skeleton /><Skeleton width="70%" /><Skeleton width="50%" /></Card>
            <Card style={{ gap: 10 }}><Skeleton width="25%" height={18} /><Skeleton width="80%" /></Card>
          </View>
        ) : query.isError ? (
          query.error instanceof ApiError && query.error.offline
            ? <ErrorState message={errorMessage(query.error)} offline onRetry={() => query.refetch()} />
            : <View accessibilityRole="alert" style={{ gap: 10, paddingVertical: 24 }}><Text variant="section">Your profile couldn’t load</Text><Text variant="small">Your saved details haven’t changed.</Text><Button variant="secondary" label="Try again" onPress={() => query.refetch()} /></View>
        ) : !profile ? (
          <View style={{ gap: 10, paddingVertical: 24 }}>
            <Text variant="section" accessibilityRole="header">Complete your student profile.</Text>
            <Text variant="small">Complete student onboarding to create your recruiting profile.</Text>
            <Button variant="secondary" icon={ExternalLink} label="Open on web" onPress={() => { openOnWeb("/profile"); }} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
              <View accessible={false} testID="profile-avatar" style={{ width: 80, height: 80, borderRadius: 40, overflow: "hidden", backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
                {localPhoto && profile.headshotUrl ? <Image source={{ uri: localPhoto }} style={{ width: 80, height: 80 }} contentFit="cover" />
                  : <Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.sansMedium, fontSize: 28, lineHeight: 34, color: colors.primary }}>{initials(profile)}</Text>}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text variant="title" accessibilityRole="header" testID="profile-name">{profile.firstName} {profile.lastName}</Text>
                <Text variant="small">{profile.major} · Class of {profile.gradYear}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <Button size="compact" icon={Pencil} testID="profile-edit" label="Edit profile" onPress={() => edit("identity")} />
                  {linkedin ? <Button size="compact" variant="secondary" icon={Linkedin} testID="profile-linkedin-open" label="LinkedIn" accessibilityHint="Opens in the browser" onPress={() => { openExternal(linkedin); }} /> : null}
                  {resume ? <Button size="compact" variant="secondary" icon={FileText} testID="profile-resume-view" label="View résumé" accessibilityHint="Opens in the browser" onPress={() => { if (/^https?:\/\//i.test(resume)) openExternal(resume); else openOnWeb(resume); }} /> : null}
                </View>
              </View>
            </View>
            <AlumniBanner />

            {!allAdded ? (
              <Card style={{ gap: 10 }} testID="profile-checklist">
                <Text variant="card" accessibilityRole="header">Profile details</Text>
                <Text variant="caption">{completed} of {checklist.length} profile details added. These are suggestions, not application requirements.</Text>
                <View accessibilityRole="progressbar" accessibilityLabel="Profile details added" accessibilityValue={{ min: 0, max: checklist.length, now: completed }} style={{ height: 4, borderRadius: 2, backgroundColor: colors.secondary, overflow: "hidden" }}>
                  <View style={{ height: 4, width: `${(completed / checklist.length) * 100}%`, backgroundColor: colors.primary }} />
                </View>
                <View style={{ gap: 8 }}>
                  {checklist.map(item => (
                    <View key={item.label} accessible accessibilityLabel={`${item.label}${item.complete ? " added" : " not yet added"}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: item.complete ? colors.secondary : "transparent", borderWidth: item.complete ? 0 : 1, borderColor: colors.border }}>
                        {item.complete ? <Check size={12} color={colors.primary} /> : null}
                      </View>
                      <Text variant="small">{item.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            <Card style={{ gap: 8 }} testID="profile-education">
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text variant="card" accessibilityRole="header" style={{ flex: 1 }}>Education</Text>
                <Button variant="ghost" size="compact" testID="profile-edit-education" label="Edit" accessibilityHint="Edit education" onPress={() => edit("education")} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                <Text variant="bodyStrong">University of Virginia</Text>
                <Text variant="small" style={{ fontVariant: ["tabular-nums"] }}>Class of {profile.gradYear}</Text>
              </View>
              <Text variant="small">{profile.major}</Text>
              {profile.highSchool ? <Text variant="small" color={colors.foreground}>High school: {profile.highSchool}</Text> : null}
              {profile.gender || profile.pronouns ? <Text variant="small" color={colors.foreground}>{[profile.gender && `Gender: ${profile.gender}`, profile.pronouns && `Pronouns: ${profile.pronouns}`].filter(Boolean).join(" · ")}</Text> : null}
              {profile.transferStudent ? <Text variant="small" color={colors.foreground}>Transfer student</Text> : null}
              <Line label="Scholar status:" value={scholar ?? "Not provided"} />
              {profile.gpa != null || profile.satScore != null || profile.actScore != null ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 4 }}>
                  {profile.gpa != null ? <Line label="GPA" value={profile.gpa >= 0 && profile.gpa <= 4 ? `${profile.gpa} / 4.00` : `${profile.gpa} · Confirm a GPA out of 4.0 in Education`} /> : null}
                  {profile.actScore != null ? <Line label="ACT" value={String(profile.actScore)} /> : null}
                  {profile.satScore != null ? <Line label="SAT" value={String(profile.satScore)} /> : null}
                </View>
              ) : null}
            </Card>

            <Card style={{ gap: 8 }} testID="profile-phone-card">
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text variant="card" accessibilityRole="header" style={{ flex: 1 }}>Phone</Text>
                <Button variant="ghost" size="compact" testID="profile-edit-phone" label="Edit" accessibilityHint="Edit phone" onPress={() => edit("contact")} />
              </View>
              <Text variant="small">Clubs call applicants they accept. Only a club that accepts you sees your number.</Text>
              {formatPhone(profile.phone) ? <Text testID="profile-phone-value" variant="body" style={{ fontVariant: ["tabular-nums"] }}>{formatPhone(profile.phone)}</Text> : <Text variant="small">Not added. Required before you submit an application.</Text>}
            </Card>

            {afterGraduation ? (
              <Card style={{ gap: 8 }} testID="profile-after-graduation">
                <Text variant="card" accessibilityRole="header">After graduation</Text>
                <Line label="Working at" value={work || "Not added"} />
                <Line label="Clubs’ alumni list" value={profile.alumniDirectoryVisible ?? true ? "Shown to current members" : "Hidden"} />
                <Line label="“Where members go”" value={profile.alumniPlacementShare ?? true ? "Company name added" : "Not added"} />
                <Button variant="secondary" size="compact" icon={ExternalLink} label="Open on web" accessibilityHint="Edit your after-graduation details on the site" onPress={() => { openOnWeb("/profile"); }} />
              </Card>
            ) : null}

            <Card padded={false} style={{ paddingHorizontal: 16, borderRadius: radius.lg }}>
              <Row testID="profile-settings" leading={<Settings size={22} color={colors.brandInk} />} title="Settings" trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => router.push("/settings" as never)} />
              <Divider />
              <Row testID="profile-tasks" title="Tasks" detail="Your tasks across clubs" trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => router.push("/tasks")} />
            </Card>

            <EditProfileSheet open={!!editing} initialSection={lastSection} profile={profile} onClose={() => setEditing(null)} onSaved={() => {}} onLocalPhoto={setLocalPhoto} />
          </>
        )}
      </ScreenScroll>
      <Header title="Profile" actions={<IconButton icon={Settings} label="Settings" testID="profile-header-settings" onPress={() => router.push("/settings" as never)} />} />
    </View>
  );
}
