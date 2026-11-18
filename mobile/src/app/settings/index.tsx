import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ArrowUpRight, CalendarPlus, ChevronRight } from "~/components/icons";
import { CalendarFeedSheet } from "~/components/profile/calendar-feed-sheet";
import { Text } from "~/components/text";
import { Card, Divider, Press, ScreenScroll, TARGET } from "~/components/ui";
import { openOnWeb } from "~/lib/links";
import { useTheme } from "~/lib/theme";

// The web's Settings overview (lib/settings-navigation.ts `personalSettingsSections`), same labels and descriptions.
const sections = [
  { id: "account", label: "Account & Security", description: "Your sign-in information and account security.", route: "/settings/account" },
  { id: "notifications", label: "Notifications", description: "Choose which club updates and reminders reach your email.", route: "/settings/notifications" },
  { id: "availability", label: "Availability", description: "Keep one availability schedule across all your clubs.", web: "/settings/availability" },
  { id: "interests", label: "Interests", description: "What you’re into, so we can suggest clubs. Only you see this.", web: "/settings/interests" },
  { id: "interviews", label: "Interview schedule", description: "Your approved interview panels across all your clubs.", web: "/settings/interviews" },
] as const;

export default function SettingsOverview() {
  const { colors } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const [feed, setFeed] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="settings-screen">
        <Text variant="display" accessibilityRole="header">Settings</Text>
        <Card padded={false} style={{ paddingHorizontal: 16 }} accessibilityLabel="Settings overview">
          {sections.map((section, index) => {
            const web = "web" in section ? section.web : null;
            return (
              <View key={section.id}>
                {index ? <Divider /> : null}
                <Press large testID={`settings-${section.id}`} accessibilityRole={web ? "link" : "button"} accessibilityLabel={`${section.label}. ${section.description}`} accessibilityHint={web ? "Opens on the web" : undefined}
                  onPress={() => { if (web) openOnWeb(web); else router.push(("route" in section ? section.route : "/settings") as never); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: TARGET + 12 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="bodyStrong">{section.label}</Text>
                    <Text variant="small">{section.description}</Text>
                    {web ? <Text variant="caption">Open on web</Text> : null}
                  </View>
                  {web ? <ArrowUpRight size={18} color={colors.mutedForeground} /> : <ChevronRight size={18} color={colors.mutedForeground} />}
                </Press>
              </View>
            );
          })}
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
      </ScreenScroll>
      <Header title="Settings" back />
      <CalendarFeedSheet open={feed} onClose={() => setFeed(false)} />
    </View>
  );
}
