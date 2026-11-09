import { Tabs } from "expo-router/js-tabs";
import { Dock } from "@/components/dock";

/**
 * Five student tabs (Mobile Design Inspiration doc) in the web's floating navy
 * dock, so the app reads as the same product as out-class.net.
 */
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <Dock {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
