import { useRouter } from "expo-router";
import { ApplicationsList } from "~/components/applications/applications-list";
import { MyClubsList } from "~/components/clubs/my-clubs-list";
import { ChevronRight, Users } from "~/components/icons";
import { Card, Row } from "~/components/ui";
import { useMiddleTab } from "~/lib/middle-tab";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { Me } from "~/lib/types";

/**
 * The dock's middle tab: Apply (every application, by stage) while one is still open, My Clubs once
 * they are all settled. See lib/middle-tab.ts for when it switches.
 */
export default function ClubsTab() {
  const mode = useMiddleTab();
  return mode === "clubs" ? <MyClubs /> : <Apply />;
}

/** The Applications list, with a way to the clubs the person already belongs to. */
function Apply() {
  const router = useRouter();
  const { colors } = useTheme();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const clubs = me.data?.memberships.length ?? 0;
  return (
    <ApplicationsList
      tab
      extra={clubs ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          <Row testID="apply-my-clubs" leading={<Users size={22} color={colors.brandInk} />} title="My clubs" detail={clubs === 1 ? "1 club" : `${clubs} clubs`} trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => router.push("/my-clubs")} />
        </Card>
      ) : null}
    />
  );
}

function MyClubs() {
  return <MyClubsList tab />;
}
