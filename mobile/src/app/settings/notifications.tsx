import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { NotificationPreferencesForm } from "~/components/inbox/preferences";
import { Text } from "~/components/text";
import { Card, ScreenScroll } from "~/components/ui";

/** Notification settings as a page (the same form the Inbox opens as a sheet). */
export default function NotificationSettings() {
  const top = useHeaderInset();
  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="settings-notifications-screen">
        <Text variant="display" accessibilityRole="header">Notifications</Text>
        <Card><NotificationPreferencesForm /></Card>
      </ScreenScroll>
      <Header title="Settings" back />
    </View>
  );
}
