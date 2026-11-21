import { useRouter } from "expo-router";
import { View } from "react-native";
import type { IconComponent } from "~/components/icon-factory";
import { ChevronRight, Gavel, Megaphone, ShieldCheck, Users, Video } from "~/components/icons";
import { type LeaderTools, leaderTools } from "~/components/leader/access";
import { Text } from "~/components/text";
import { Card, ClubMark, Divider, Press, TARGET } from "~/components/ui";
import { useTheme } from "~/lib/theme";
import type { Me, Membership } from "~/lib/types";

type Shortcut = { key: keyof LeaderTools; label: string; icon: IconComponent; path: string };
const shortcuts: Shortcut[] = [
  { key: "applicants", label: "Applicants", icon: Users, path: "/leader/[clubId]/applicants" },
  { key: "interviews", label: "Interviews", icon: Video, path: "/leader/[clubId]/interviews" },
  { key: "voting", label: "Voting", icon: Gavel, path: "/leader/[clubId]/voting" },
  { key: "announce", label: "Announce", icon: Megaphone, path: "/leader/[clubId]/announce" },
];
/** The shortcuts this membership may use, in the hub's order; the hub itself holds the rest (check-in, settings on the web). */
export const leaderShortcuts = (membership: Membership, profile?: Me["profile"]) => {
  const tools = leaderTools(membership, profile);
  return shortcuts.filter(shortcut => tools[shortcut.key]);
};

/**
 * Home's way into leader tools: its own titled card near the top, one block per club the person
 * leads, with the club's tools one tap away. Callers pass only memberships that have leader tools.
 */
export function LeaderToolsCard({ memberships, profile }: { memberships: Membership[]; profile?: Me["profile"] }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  if (!memberships.length) return null;
  const go = (pathname: string, clubId: string) => router.push({ pathname, params: { clubId } } as never);
  return (
    <Card tone="blue" style={{ gap: 12 }} testID="home-leader-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={22} weight="fill" color={colors.brandInk} />
        <Text variant="section" accessibilityRole="header" style={{ flex: 1 }}>Leader tools</Text>
      </View>
      {memberships.map((membership, index) => {
        const tools = leaderShortcuts(membership, profile);
        return (
          <View key={membership.id} style={{ gap: 10 }}>
            {index ? <Divider /> : null}
            <Press testID="home-leader-tools" accessibilityRole="button" accessibilityLabel={`Open leader tools for ${membership.club.name}`} onPress={() => go("/leader/[clubId]", membership.clubId)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET + 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border }}>
              <ClubMark name={membership.club.name} color={membership.club.color} logoUrl={membership.club.logoUrl} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={2}>{membership.club.name}</Text>
                <Text variant="small" numberOfLines={1}>{membership.title ?? "Leader"} · Open leader tools</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedForeground} />
            </Press>
            {tools.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {tools.map(tool => (
                  <Press key={tool.key} testID={`home-leader-${tool.key}`} accessibilityRole="button" accessibilityLabel={`${tool.label}, ${membership.club.name}`} onPress={() => go(tool.path, membership.clubId)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: TARGET, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                    <tool.icon size={16} color={colors.brandInk} />
                    <Text variant="smallStrong">{tool.label}</Text>
                  </Press>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
