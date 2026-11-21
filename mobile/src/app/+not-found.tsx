import { useRouter } from "expo-router";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { Compass, Home } from "~/components/icons";
import { Button, Card, EmptyState, ScreenScroll } from "~/components/ui";

/** An outclass:// link with no screen behind it lands here, not on the router's developer page. */
export default function NotFoundScreen() {
  const router = useRouter();
  const top = useHeaderInset();
  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="not-found-screen">
        <Card>
          <EmptyState icon={Compass} title="This page isn’t in the app" body="The link may be old or meant for the website."
            action={<Button label="Go to Home" icon={Home} onPress={() => router.replace("/")} />} />
        </Card>
      </ScreenScroll>
      <Header title="Not found" back />
    </View>
  );
}
