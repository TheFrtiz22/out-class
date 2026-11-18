import { View } from "react-native";
import { GraduationCap } from "~/components/icons";
import { Text } from "~/components/text";
import { Card } from "~/components/ui";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { Me } from "~/lib/types";

/**
 * Alumni accounts are read-only (lib/graduation.ts): they sign in and see their own account,
 * profile and history, and keep personal settings (profile, notifications, account). The server
 * refuses everything else with the messages below; screens hide those controls the same way the
 * web does and show the matching line instead.
 *
 * `useIsAlumni()` is the web's `isAlumniProfile(me.profile)`: graduatedAt is set and has passed.
 * It only decides what to show. It is never a permission check.
 */
export const ALUMNI_REFUSALS = {
  apply: "Congratulations on graduating. Alumni accounts can’t submit new applications; your past applications stay in your history.",
  rsvp: "Alumni accounts can’t RSVP to events or change an RSVP. Your past RSVPs stay in your history.",
  checkIn: "Alumni accounts can’t check in to meetings. Your past attendance stays in your history.",
  vote: "Alumni accounts can’t vote. Your vote was not recorded.",
  join: "Alumni accounts can’t join clubs. Your past memberships stay in your history.",
  respond: "Alumni accounts can’t accept or decline offers or invitations. Your past decisions stay in your history.",
  book: "Alumni accounts can’t book, move or cancel interviews. Your past interviews stay in your history.",
  task: "Alumni accounts can’t submit tasks. Your past submissions stay in your history.",
  save: "Alumni accounts can’t save or remove clubs and events. Your saved items stay as they are.",
  survey: "Alumni accounts can’t edit the interest survey. Your answers stay as they are.",
  availability: "Alumni accounts can’t edit availability. Your saved availability stays as it is.",
  share: "Alumni accounts can’t create share links. The full page address still works.",
  manage: "You’ve graduated, so this club is read-only for you. Hand it to a current member to keep it running.",
} as const;
export type AlumniAction = keyof typeof ALUMNI_REFUSALS;

export function isAlumniProfile(profile: { graduatedAt?: string | null } | null | undefined, now = Date.now()): boolean {
  return !!profile?.graduatedAt && +new Date(profile.graduatedAt) <= now;
}

/** Whether the signed-in account is an alumni account. False while `me` is loading. */
export function useIsAlumni(): boolean {
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  return isAlumniProfile(me.data?.profile);
}

/**
 * A calm note for alumni. With `action` it is the web's line for that feature (shown in place of
 * the hidden control); without it, the account-level note. Renders nothing for current students.
 */
export function AlumniBanner({ action, testID = "alumni-banner" }: { action?: AlumniAction; testID?: string }) {
  const { colors } = useTheme();
  const alumni = useIsAlumni();
  if (!alumni) return null;
  return (
    <Card tone="soft" testID={testID} accessibilityRole="summary" style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <GraduationCap size={22} color={colors.mutedForeground} />
      <View style={{ flex: 1, gap: 2 }}>
        {action ? null : <Text variant="bodyStrong">Alumni account</Text>}
        <Text variant="small" color={action ? colors.foreground : colors.mutedForeground}>{action ? ALUMNI_REFUSALS[action] : "Your account stays as an alumni account, with your profile and history. Clubs list you as alumni."}</Text>
      </View>
    </Card>
  );
}
