import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ScreenScroll } from "~/components/ui";
import { Text } from "~/components/text";

export default function Inbox() {
  const top = useHeaderInset();
  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll dock top={top}><Text variant="display">Inbox</Text></ScreenScroll>
      <Header title="Inbox" />
    </View>
  );
}
