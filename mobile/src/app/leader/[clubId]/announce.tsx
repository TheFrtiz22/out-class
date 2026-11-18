import { useMutation } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Field } from "~/components/field";
import { Header, useHeaderInset } from "~/components/header";
import { Megaphone } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Divider, ScreenScroll, Segmented } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

type Audience = "MEMBERS" | "APPLICANTS";
type Preview = { count: number; evaluatedAt: string };
type Published = { id: string; recipientCount: number };

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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("MEMBERS");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Published | null>(null);
  const requestKey = useRef(Crypto.randomUUID());

  const review = useMutation({
    mutationFn: () => api.get<Preview>("leader.announce.preview", { clubId, audience }),
    onMutate: () => setError(""),
    onSuccess: setPreview,
    onError: failure => { haptics.error(); setError(errorMessage(failure, "Could not preview recipients.")); },
  });
  const publish = useMutation({
    mutationFn: () => api.post<Published>("leader.announce", { clubId, title: title.trim(), body: body.trim(), audience, requestKey: requestKey.current }),
    onSuccess: result => { haptics.confirm(); setPreview(null); setDone(result); },
    onError: failure => { haptics.error(); setPreview(null); setError(errorMessage(failure, "Publishing failed.")); },
  });
  const ready = title.trim().length > 0 && body.trim().length > 0;

  if (done) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenScroll top={top} testID="announce-done">
          <Card style={{ gap: 12, alignItems: "flex-start" }}>
            <Megaphone size={28} color={colors.success} />
            <Text variant="title" accessibilityRole="header">Published</Text>
            <Text variant="body">Published to {done.recipientCount} recipient{done.recipientCount === 1 ? "" : "s"}.</Text>
            <Button label="Done" onPress={() => router.back()} />
          </Card>
        </ScreenScroll>
        <Header title="Announce" back />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="announce-screen">
        <Text variant="small">Announcements you publish land in each recipient’s inbox and stay listed here.</Text>
        <View style={{ gap: 6 }}>
          <Text variant="smallStrong">Recipient type</Text>
          <Segmented label="Recipient type" value={audience} onChange={setAudience} options={[{ value: "MEMBERS", label: "Members" }, { value: "APPLICANTS", label: "Active applicants" }]} />
        </View>
        <Field label="Title" testID="announce-title" value={title} onChangeText={setTitle} maxLength={200} returnKeyType="next" />
        <Field label="Announcement" testID="announce-body" value={body} onChangeText={setBody} maxLength={10000} multiline />
        {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
        <Button full size="large" testID="announce-review" label={review.isPending ? "Reviewing recipients…" : "Publish announcement"} loading={review.isPending} disabled={!ready} onPress={() => review.mutate()} />
        <Text variant="caption">Custom audiences and scheduled sends are on the web.</Text>
      </ScreenScroll>
      <Header title="Announce" back />
      <Sheet open={!!preview} onClose={() => setPreview(null)} title="Publish this announcement?" testID="announce-confirm">
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 14 }}>
          <Text variant="body">The currently resolved audience will receive an in-app update and optional email according to their preferences.</Text>
          <Card tone="soft" style={{ gap: 6 }}>
            <Text variant="card">{title.trim()}</Text>
            <Text variant="small" color={colors.foreground}>{body.trim()}</Text>
            <Divider />
            <Text variant="smallStrong" accessibilityRole="text">{preview?.count ?? 0} unique recipient(s)</Text>
            <Text variant="caption">Publication rechecks current permissions and recipient data.</Text>
          </Card>
          <Button full size="large" testID="announce-publish" label={publish.isPending ? "Publishing…" : "Publish now"} loading={publish.isPending} onPress={() => publish.mutate()} />
          <Button full size="large" variant="secondary" label="Cancel" onPress={() => setPreview(null)} />
        </ScrollView>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
