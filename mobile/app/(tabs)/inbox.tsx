import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, Title } from "@/components/ui";
import { space, useTheme } from "@/theme/tokens";

/** Inbox: messages, decisions and notifications. Wired to /api/v1 in the next build. */
export default function Inbox() {
  const t = useTheme();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Title>Inbox</Title>
        <EmptyState title="Messages are coming next" body="Club messages and application decisions will appear here. For now, check out-class.net." />
      </ScrollView>
    </SafeAreaView>
  );
}
