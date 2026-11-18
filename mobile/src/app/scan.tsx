import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ScreenScroll } from "~/components/ui";

export default function Placeholder() {
  const top = useHeaderInset();
  return <View style={{ flex: 1 }}><ScreenScroll top={top} /><Header title="scan" back /></View>;
}
