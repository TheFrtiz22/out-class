import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, Title } from "@/components/ui";
import { space, useTheme } from "@/theme/tokens";

/** Calendar: events and interviews from subscribed clubs. Wired to /api/v1 in a later build. */
export default function Calendar() {
  const t = useTheme();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Title>Calendar</Title>
        <EmptyState title="Your calendar is coming soon" body="Events, interviews and coffee chats from your clubs will appear here." />
      </ScrollView>
    </SafeAreaView>
  );
}
