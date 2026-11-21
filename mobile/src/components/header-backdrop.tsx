import { View } from "react-native";
import { useHeaderInset } from "~/components/header";
import { useTheme } from "~/lib/theme";

const FADE = [0.75, 0.5, 0.25];
const STEP = 4;

/**
 * A solid canvas behind the floating header, for dense screens (the availability grid) where content
 * blurred through the glass bar reads as a jumble. Content scrolls under it and fades out just below
 * the bar. Render it before `<Header>`.
 */
export function HeaderBackdrop() {
  const { colors } = useTheme();
  const height = useHeaderInset();
  return (
    <View pointerEvents="none" testID="header-backdrop" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 19 }}>
      <View style={{ height, backgroundColor: colors.background }} />
      {FADE.map(opacity => <View key={opacity} style={{ height: STEP, backgroundColor: colors.background, opacity }} />)}
    </View>
  );
}
