import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ScreenScroll } from "~/components/ui";
import { Text } from "~/components/text";

export default function Profile() {
  const top = useHeaderInset();
  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll dock top={top}><Text variant="display">Profile</Text></ScreenScroll>
      <Header title="Profile" />
    </View>
  );
}
