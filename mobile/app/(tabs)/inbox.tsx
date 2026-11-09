import { Text } from "react-native";
import { Screen } from "@/components/screen";
import { ScreenHeader, SectionTitle, Segmented, Surface } from "@/components/ui";
import { useState } from "react";
import { text, useTheme } from "@/theme/tokens";

/** Inbox: club messages, application decisions and notifications. Data arrives with the inbox endpoints. */
export default function Inbox() {
  const t = useTheme();
  const [filter, setFilter] = useState<"all" | "applications" | "clubs">("all");
  return (
    <Screen>
      <ScreenHeader title="Inbox" subtitle="Messages and decisions from your clubs." />
      <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "applications", label: "Applications" }, { value: "clubs", label: "Clubs" }]} />
      <SectionTitle title="Today" />
      <Surface>
        <Text style={[text.body, { color: t.muted }]}>
          <Text style={[text.bodyStrong, { color: t.ink }]}>You’re all caught up. </Text>
          Club messages, interview invitations and decisions will arrive here, with a notification on your phone.
        </Text>
      </Surface>
    </Screen>
  );
}
