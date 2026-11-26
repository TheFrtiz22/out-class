/**
 * Inbox redesign (Nov 25): rows lead with the club, then the title, a two-line preview and the type; unread rows
 * carry a dot instead of a colored left stripe; urgent updates carry a white-on-red pill that stays readable in
 * light and dark appearance. Swipe and VoiceOver actions are unchanged.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { URGENT_RED } from "~/components/inbox/presentation";
import { InboxListRow } from "~/components/inbox/row";
import { ThemeProvider } from "~/lib/theme";
import type { InboxRow } from "~/lib/types";
import { captureConsole, releaseConsole } from "./harness";

beforeEach(async () => { captureConsole(); await AsyncStorage.clear(); });
afterEach(releaseConsole);

const flat = (style: unknown) => StyleSheet.flatten(style as never) ?? {};
const row = (extra: Partial<InboxRow> = {}) => ({ id: "n1", type: "INTERVIEW", title: "Interview panel schedule · First interview", body: "Thu, Nov 26 · Room 1 · 10:00–10:30 AM", href: null, readAt: null, createdAt: new Date(Date.now() - 2 * 3600e3).toISOString(), club: { name: "McIntire Investment Institute", color: "#142d45", logoUrl: null }, ...extra }) as unknown as InboxRow;

async function show(item: InboxRow, appearance: "light" | "dark") {
  await AsyncStorage.setItem("outclass.appearance", appearance);
  await render(<GestureHandlerRootView style={{ flex: 1 }}><ThemeProvider><InboxListRow item={item} now={Date.now()} first last onOpen={() => {}} onRead={() => {}} onArchive={() => {}} /></ThemeProvider></GestureHandlerRootView>);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

describe.each(["light", "dark"] as const)("inbox row in %s appearance", appearance => {
  test("an urgent update shows a white-on-red pill and is announced as urgent", async () => {
    await show(row(), appearance);
    const label = screen.getByText("Urgent");
    expect(flat(label.props.style).color).toBe("#ffffff");
    type Node = { parent: Node | null; props: { style?: unknown } };
    let node: Node | null = label as unknown as Node;
    let background: unknown;
    while (node && !background) { background = (flat(node.props.style) as { backgroundColor?: unknown }).backgroundColor; node = node.parent; }
    expect(background).toBe(URGENT_RED);
    expect(screen.getByTestId("inbox-row-interview").props.accessibilityLabel).toMatch(/^Unread\. Urgent\. McIntire Investment Institute\. /);
  });

  test("unread rows use a dot, not a colored left stripe; read rows show neither", async () => {
    await show(row({ type: "ANNOUNCEMENT" }), appearance);
    const press = screen.getByTestId("inbox-row-announcement");
    expect(flat(press.props.style).borderLeftWidth ?? 0).toBe(0);
    expect(screen.queryByText("Urgent")).toBeNull();
    expect(screen.getByText("Announcement")).toBeTruthy();
    expect(screen.getByText("2 hr. ago")).toBeTruthy();
  });
});
