import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Field, type FieldRef } from "~/components/field";
import { Header, useHeaderInset } from "~/components/header";
import { Megaphone } from "~/components/icons";
import { canAnnounceToApplicants } from "~/components/leader/access";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Divider, ScreenScroll, Segmented, SectionHeader, Skeleton } from "~/components/ui";
import { ApiError, api, errorMessage } from "~/lib/api";
import { easternShortDateTime } from "~/lib/eastern";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { Me } from "~/lib/types";

type Audience = "MEMBERS" | "APPLICANTS";
type Preview = { count: number; evaluatedAt: string };
type Published = { id: string; recipientCount: number };
// actions/communications.ts getClubAnnouncements: the club's 50 latest, newest first.
type Sent = { id: string; title: string; body: string; audience: string; publishedAt: string; _count: { notifications: number } };
const audienceLabels: Record<string, string> = { MEMBERS: "Members", APPLICANTS: "Active applicants", CUSTOM: "Custom audience" };

/**
 * Quick announce: to Members or Active applicants through the web's own publication path
 * (publishClubAnnouncement -> inbox rows -> the email outbox and push). The same two-step flow as
 * the site: review the resolved recipients, then confirm. `requestKey` makes a retry after a lost
 * connection the same announcement, never a second one.
 */
export default function Announce() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { colors } = useTheme();
  const top = useHeaderInset();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [chosen, setAudience] = useState<Audience>("MEMBERS");
  // Active applicants only for a leader the server lets identify recipients (utils/recipient-audience.ts);
  // anyone else would write the post and then get "Identified applicant recipient access required."
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const membership = me.data?.memberships.find(item => item.clubId === clubId);
  const applicants = !!membership && canAnnounceToApplicants(membership, me.data?.profile);
  const audience: Audience = applicants ? chosen : "MEMBERS";
  const bodyField = useRef<FieldRef>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // The sheet keeps showing the last count while it slides away, never a flash of "0".
  const [shown, setShown] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Published | null>(null);
  const requestKey = useRef(Crypto.randomUUID());
  const sent = useApiQuery<Sent[]>("leader.announcements", { clubId }, { scope: "leader" });

  const review = useMutation({
    mutationFn: () => api.get<Preview>("leader.announce.preview", { clubId, audience }),
    onMutate: () => setError(""),
    onSuccess: result => { setPreview(result); setShown(result); },
    onError: failure => { haptics.error(); setError(errorMessage(failure, "Could not preview recipients.")); },
  });
  const publish = useMutation({
    mutationFn: () => api.post<Published>("leader.announce", { clubId, title: title.trim(), body: body.trim(), audience, requestKey: requestKey.current }),
    onSuccess: result => { haptics.confirm(); setPreview(null); setDone(result); void queryClient.invalidateQueries({ queryKey: ["leader", "leader.announcements"] }); },
    onError: failure => {
      haptics.error(); setPreview(null);
      // STALE: this request key already published different text. The next publish is a new announcement.
      if (failure instanceof ApiError && failure.code === "STALE") requestKey.current = Crypto.randomUUID();
      setError(errorMessage(failure, "Publishing failed. Check your connection; publishing again won't send it twice."));
    },
  });
  const startOver = () => { requestKey.current = Crypto.randomUUID(); setTitle(""); setBody(""); setError(""); setDone(null); };
  const ready = title.trim().length > 0 && body.trim().length > 0;

  if (done) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenScroll top={top} testID="announce-done">
          <Card style={{ gap: 12, alignItems: "flex-start" }}>
            <Megaphone size={28} color={colors.success} />
            <Text variant="title" accessibilityRole="header">Published</Text>
            <Text variant="body">Published to {done.recipientCount} recipient{done.recipientCount === 1 ? "" : "s"}. It's in their OutClass inbox now, and email goes out according to each person's preferences.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Button label="Done" testID="announce-finish" onPress={() => router.back()} />
              <Button label="Write another" variant="secondary" testID="announce-another" onPress={startOver} />
            </View>
          </Card>
        </ScreenScroll>
        <Header title="Announce" back />
      </View>
    );
  }
  return (
    // ScreenScroll keeps the focused field above the keyboard itself; a KeyboardAvoidingView on top of it doubled the gap.
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="announce-screen" refreshing={sent.isRefetching} onRefresh={() => { void sent.refetch(); }}>
        <Text variant="small">Announcements you publish land in each recipient’s OutClass inbox, with email according to their preferences.</Text>
        {applicants ? (
          <View style={{ gap: 6 }}>
            <Text variant="smallStrong">Recipient type</Text>
            <Segmented label="Recipient type" value={audience} onChange={setAudience} options={[{ value: "MEMBERS", label: "Members" }, { value: "APPLICANTS", label: "Active applicants" }]} />
          </View>
        ) : <Text variant="smallStrong" testID="announce-members-only">To: Members</Text>}
        <Field label="Title" testID="announce-title" value={title} onChangeText={setTitle} maxLength={200} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => bodyField.current?.focus()} />
        <Field ref={bodyField} label="Announcement" testID="announce-body" value={body} onChangeText={setBody} maxLength={10000} multiline />
        {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
        <Button full size="large" testID="announce-review" label={review.isPending ? "Reviewing recipients…" : "Publish announcement"} loading={review.isPending} disabled={!ready} onPress={() => review.mutate()} />
        <Text variant="caption">Custom audiences and scheduled sends are on the web.</Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          <SectionHeader title="Recent announcements" />
          {sent.isPending ? <Card style={{ gap: 8 }}><Skeleton width="60%" height={16} /><Skeleton width="90%" /></Card>
            : sent.isError && !sent.data ? <Text variant="small">Recent announcements didn’t load. Pull down to retry.</Text>
            : !sent.data?.length ? <Text variant="small">Nothing published yet.</Text>
            : (
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {sent.data.slice(0, 10).map((item, index) => (
                  <View key={item.id}>
                    {index ? <Divider /> : null}
                    <View accessible style={{ paddingVertical: 12, gap: 2 }}>
                      <Text variant="bodyStrong" numberOfLines={2}>{item.title}</Text>
                      <Text variant="small" numberOfLines={2}>{item.body}</Text>
                      <Text variant="caption">{easternShortDateTime(item.publishedAt)} · {audienceLabels[item.audience] ?? "Recipients"} · {item._count.notifications} recipient{item._count.notifications === 1 ? "" : "s"}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}
        </View>
      </ScreenScroll>
      <Header title="Announce" back />
      <Sheet open={!!preview} onClose={() => setPreview(null)} dismissible={!publish.isPending} title="Publish this announcement?" testID="announce-confirm">
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 14 }}>
          <Text variant="body">The currently resolved audience will receive an in-app update and optional email according to their preferences.</Text>
          <Card tone="soft" style={{ gap: 6 }}>
            <Text variant="card">{title.trim()}</Text>
            <Text variant="small" color={colors.foreground}>{body.trim()}</Text>
            <Divider />
            <Text variant="smallStrong" accessibilityRole="text">{shown?.count ?? 0} {audience === "MEMBERS" ? "member" : "applicant"}{shown?.count === 1 ? "" : "s"} will receive this</Text>
            <Text variant="caption">Publication rechecks current permissions and recipient data.</Text>
          </Card>
          {shown && !shown.count ? <Text variant="small" color={colors.destructive}>No one in this audience can receive announcements right now.</Text> : null}
          <Button full size="large" testID="announce-publish" label={publish.isPending ? "Publishing…" : "Publish now"} loading={publish.isPending} disabled={!shown?.count} onPress={() => publish.mutate()} />
          <Button full size="large" variant="secondary" label="Cancel" disabled={publish.isPending} onPress={() => setPreview(null)} />
        </ScrollView>
      </Sheet>
    </View>
  );
}
