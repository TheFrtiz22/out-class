import * as Application from "expo-application";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import type { IconComponent } from "~/components/icon-factory";
import { CalendarPlus, ChevronRight, FileText, Mail, ShieldCheck } from "~/components/icons";
import { LEGAL_ROUTES, NOT_AFFILIATED, SUPPORT_EMAIL, contactSupport } from "~/components/legal";
import { CalendarFeedSheet } from "~/components/profile/calendar-feed-sheet";
import { Text } from "~/components/text";
import { Card, Divider, Press, ScreenScroll, Segmented, TARGET } from "~/components/ui";
import { type AppearancePreference, useTheme } from "~/lib/theme";

// The web's Settings overview (lib/settings-navigation.ts `personalSettingsSections`), same labels and descriptions.
const sections = [
  { id: "account", label: "Account & Security", description: "Your sign-in information and account security.", route: "/settings/account" },
  { id: "notifications", label: "Notifications", description: "Choose which club updates and reminders reach your email.", route: "/settings/notifications" },
  { id: "availability", label: "Availability", description: "Keep one availability schedule across all your clubs.", route: "/settings/availability" },
  { id: "interests", label: "Interests", description: "What you’re into, so we can suggest clubs. Only you see this.", route: "/settings/interests" },
  { id: "interviews", label: "Interview schedule", description: "Your approved interview panels across all your clubs.", route: "/settings/interviews" },
] as const;

/** Legal & support: the in-app Terms and Privacy Policy, and email to support (App Store 5.1.1, Google Play user data policy). */
const legalRows: { id: string; label: string; description: string; icon: IconComponent; route?: string }[] = [
  { id: "terms", label: "Terms of Service", description: "The rules for using OutClass.", icon: FileText, route: LEGAL_ROUTES.terms },
  { id: "privacy", label: "Privacy Policy", description: "What we collect and how we use it.", icon: ShieldCheck, route: LEGAL_ROUTES.privacy },
  { id: "support", label: "Contact support", description: SUPPORT_EMAIL, icon: Mail },
];

export default function SettingsOverview() {
  const { colors, appearance, setAppearance } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const [feed, setFeed] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="settings-screen">
        <Card padded={false} style={{ paddingHorizontal: 16 }} accessibilityLabel="Settings overview">
          {sections.map((section, index) => {
            return (
              <View key={section.id}>
                {index ? <Divider /> : null}
                <Press large testID={`settings-${section.id}`} accessibilityRole="button" accessibilityLabel={`${section.label}. ${section.description}`}
                  onPress={() => router.push(section.route as never)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: TARGET + 12 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="bodyStrong">{section.label}</Text>
                    <Text variant="small">{section.description}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.mutedForeground} />
                </Press>
              </View>
            );
          })}
        </Card>

        <Card style={{ gap: 12 }} testID="settings-appearance">
          <View style={{ gap: 3 }}>
            <Text variant="bodyStrong" accessibilityRole="header">Appearance</Text>
            <Text variant="small">System matches your phone’s light or dark setting.</Text>
          </View>
          <Segmented<AppearancePreference> label="Appearance" value={appearance} onChange={setAppearance}
            options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        </Card>

        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          <Press large testID="settings-calendar-feed" accessibilityLabel="Subscribe. Add OutClass to your calendar" onPress={() => setFeed(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: TARGET + 12 }}>
            <CalendarPlus size={22} color={colors.brandInk} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="bodyStrong">Subscribe</Text>
              <Text variant="small">Add OutClass to your calendar</Text>
            </View>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Press>
        </Card>
        <Card padded={false} style={{ paddingHorizontal: 16 }} testID="settings-legal" accessibilityLabel="Legal & support">
          <Text variant="bodyStrong" accessibilityRole="header" style={{ paddingTop: 14 }}>Legal & support</Text>
          {legalRows.map((row, index) => (
            <View key={row.id}>
              {index ? <Divider /> : null}
              <Press large testID={`settings-${row.id}`} accessibilityRole={row.route ? "button" : "link"} accessibilityLabel={`${row.label}. ${row.description}`}
                onPress={() => (row.route ? router.push(row.route as never) : contactSupport())}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: TARGET + 12 }}>
                <row.icon size={22} color={colors.brandInk} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="bodyStrong">{row.label}</Text>
                  <Text variant="small">{row.description}</Text>
                </View>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </Press>
            </View>
          ))}
          <Divider />
          <Text variant="caption" testID="settings-not-affiliated" style={{ paddingVertical: 14 }}>{NOT_AFFILIATED}</Text>
        </Card>
        {Application.nativeApplicationVersion ? (
          <Text variant="caption" align="center" testID="settings-version" style={{ marginTop: 4 }}>
            OutClass {Application.nativeApplicationVersion}{Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : ""}
          </Text>
        ) : null}
      </ScreenScroll>
      <Header title="Settings" back />
      <CalendarFeedSheet open={feed} onClose={() => setFeed(false)} />
    </View>
  );
}
