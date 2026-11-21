import { useRouter } from "expo-router";
import { useRef } from "react";
import { type ScrollViewInstance, View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ChevronRight, Compass, FilePenLine, Users } from "~/components/icons";
import { useRefetchOnFocus } from "~/components/inbox/use-refetch-on-focus";
import { leaderMemberships } from "~/components/leader/access";
import { Button, Card, Chip, ClubMark, Divider, EmptyState, ErrorState, Row, ScreenScroll, SkeletonRows } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { useApiQuery } from "~/lib/query";
import { useTabScrollToTop } from "~/lib/scroll-to-top";
import { useTheme } from "~/lib/theme";
import type { ApplicationsView, Me } from "~/lib/types";

/** The clubs the person belongs to, each opening its member page; leaders see which they run. */
export function MyClubsList({ tab = false }: { tab?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const top = useHeaderInset();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const applications = useApiQuery<ApplicationsView>("applications.view", undefined, { staleTime: 60_000 });
  useRefetchOnFocus(me);
  const scroll = useRef<ScrollViewInstance>(null);
  useTabScrollToTop(scroll);
  const leading = new Set(leaderMemberships(me.data).map(membership => membership.id));
  const memberships = me.data?.memberships ?? [];
  const decided = applications.data?.applications.length ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll ref={scroll} dock={tab} top={top} onRefresh={() => Promise.all([me.refetch(), applications.refetch()])} testID="my-clubs-screen">
        {me.isPending ? <SkeletonRows count={3} />
          : me.isError && !me.data ? <ErrorState message={errorMessage(me.error, "Your clubs couldn’t load.")} offline={me.error instanceof ApiError && me.error.offline} onRetry={() => me.refetch()} />
            : memberships.length ? (
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {memberships.map((membership, index) => (
                  <View key={membership.id}>
                    {index ? <Divider /> : null}
                    <Row
                      testID={`my-clubs-${membership.clubId}`}
                      leading={<ClubMark name={membership.club.name} color={membership.club.color} logoUrl={membership.club.logoUrl} size={40} />}
                      title={membership.club.name}
                      detail={membership.alumniSince ? "Alumni" : membership.title ?? undefined}
                      trailing={leading.has(membership.id) ? <Chip label="Leader" tone="brand" /> : <ChevronRight size={18} color={colors.mutedForeground} />}
                      onPress={() => router.push({ pathname: "/my-club/[clubId]", params: { clubId: membership.clubId } })}
                    />
                  </View>
                ))}
              </Card>
            ) : (
              <Card><EmptyState icon={Users} title="No clubs yet" body="Clubs you join appear here. An acceptance doesn’t make you a member on its own." action={<Button icon={Compass} label="Explore clubs" onPress={() => router.navigate("/explore")} />} /></Card>
            )}
        {tab && decided ? (
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            <Row testID="my-clubs-applications" leading={<FilePenLine size={22} color={colors.brandInk} />} title="Applications" detail="Your decisions and past applications" trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => router.push("/applications")} />
          </Card>
        ) : null}
        {tab ? (
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            <Row testID="my-clubs-explore" leading={<Compass size={22} color={colors.brandInk} />} title="Apply to another club" detail="Browse clubs that are recruiting" trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => router.navigate("/explore")} />
          </Card>
        ) : null}
      </ScreenScroll>
      {tab ? <Header title="My Clubs" /> : <Header title="My clubs" back />}
    </View>
  );
}
