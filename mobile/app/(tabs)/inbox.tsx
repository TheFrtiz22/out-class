import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { ClubTile, ScreenHeader, SectionTitle, Segmented, Surface } from "@/components/ui";
import { post, webUrl, type Inbox as InboxData, type InboxItem } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { space, text, useTheme } from "@/theme/tokens";

const dayLabel = (iso: string) => {
  const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** Inbox: club announcements, interview updates and decisions, grouped by day. */
export default function Inbox() {
  const t = useTheme();
  const { data, error, loading, refresh } = useApi<InboxData>("/api/v1/inbox");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => { if (data) setRead(new Set(data.items.filter((i) => i.read).map((i) => i.id))); }, [data]);
  const items = (data?.items ?? []).filter((i) => filter === "all" || !read.has(i.id));
  const groups = useMemo(() => {
    const out: { label: string; items: InboxItem[] }[] = [];
    for (const item of items) {
      const label = dayLabel(item.createdAt);
      (out.at(-1)?.label === label ? out.at(-1)! : (out.push({ label, items: [] }), out.at(-1)!)).items.push(item);
    }
    return out;
  }, [items]);
  const unread = (data?.items ?? []).filter((i) => !read.has(i.id)).length;

  const open = async (item: InboxItem) => {
    if (!read.has(item.id)) {
      setRead((s) => new Set(s).add(item.id));
      post("/api/v1/inbox", { ids: [item.id], read: true }).catch(() => setRead((s) => { const n = new Set(s); n.delete(item.id); return n; }));
    }
    if (item.href) Linking.openURL(webUrl(item.href));
  };
  const markAll = () => {
    const ids = (data?.items ?? []).filter((i) => !read.has(i.id)).map((i) => i.id).slice(0, 100);
    if (!ids.length) return;
    setRead((s) => new Set([...s, ...ids]));
    post("/api/v1/inbox", { ids, read: true }).catch(refresh);
  };

  return (
    <Screen refreshing={loading && !!data} onRefresh={refresh}>
      <ScreenHeader title="Inbox" subtitle={data ? (unread ? `${unread} unread` : "You’re all caught up.") : "Messages and decisions from your clubs."} />
      <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: unread ? `Unread (${unread})` : "Unread" }]} />
      {error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger, marginTop: space.md }]}>{error}</Text> : null}
      {data && items.length === 0 ? (
        <>
          <SectionTitle title={filter === "unread" ? "Unread" : "Today"} />
          <Surface>
            <Text style={[text.body, { color: t.muted }]}><Text style={[text.bodyStrong, { color: t.ink }]}>You’re all caught up. </Text>Club announcements, interview updates and decisions arrive here.</Text>
          </Surface>
        </>
      ) : null}
      {groups.map((g, gi) => (
        <View key={g.label}>
          <SectionTitle title={g.label} action={gi === 0 && unread ? <Pressable accessibilityRole="button" onPress={markAll} hitSlop={12}><Text style={[text.label, { color: t.info }]}>Mark all read</Text></Pressable> : undefined} />
          <Surface padded={false}>
            {g.items.map((item, i) => {
              const isRead = read.has(item.id);
              return (
                <Pressable key={item.id} accessibilityRole="button" accessibilityHint={item.href ? "Opens on out-class.net" : undefined} onPress={() => open(item)}
                  style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                  <View>
                    <ClubTile name={item.club?.name ?? "OutClass"} logoText={item.club ? undefined : "OC"} size={36} />
                    {!isRead ? <View style={[styles.dot, { backgroundColor: t.accent, borderColor: t.surface }]} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.top}>
                      <Text numberOfLines={1} style={[text.small, { color: t.muted, flex: 1 }]}>{item.club?.name ?? "OutClass"}</Text>
                      <Text style={[text.small, { color: t.faint }]}>{clock(item.createdAt)}</Text>
                    </View>
                    <Text numberOfLines={2} style={[isRead ? text.body : text.bodyStrong, { color: t.ink, marginTop: 1 }]}>{item.title}</Text>
                    {item.body ? <Text numberOfLines={2} style={[text.small, { color: t.muted, marginTop: 2 }]}>{item.body}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </Surface>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12, minHeight: 60 },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { position: "absolute", top: -3, right: -3, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
});
