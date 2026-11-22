/**
 * Nov 21: chip filters no longer scroll sideways. A few options wrap on screen and the rest sit behind
 * a "More" chip that opens a searchable list (OptionPicker), on Explore, Calendar, Applicants and every
 * FilterChips row. (Home's leader section moved to the Nov 22 redesign: home-redesign.test.tsx.)
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OptionPicker, type PickerOption, matchOptions, pickerLayout, sheetOrder } from "~/components/option-picker";
import { ThemeProvider } from "~/lib/theme";
import type { AgendaEvent, Me, Membership, PublicClub } from "~/lib/types";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, screenText } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const opts = (labels: string[]): PickerOption[] => labels.map(label => ({ value: label.toLowerCase(), label, count: label.length }));
const twelve = opts(["All", "Engineering", "Academic", "Performing Arts", "Pre-Professional", "Service", "Cultural", "Sports", "Religious", "Media", "Political", "Café Society"]);

/** True when some ancestor of the element scrolls sideways. */
type Node = { parent: Node | null; props: Record<string, unknown> };
function insideHorizontalScroll(node: Node | null) {
  for (let current = node?.parent ?? null; current; current = current.parent) if (current.props?.horizontal) return true;
  return false;
}

describe("picker layout", () => {
  test("a short list shows every option and no More chip", () => {
    expect(pickerLayout(opts(["All", "A", "B", "C", "D"]), "all", 4)).toEqual({ visible: opts(["All", "A", "B", "C", "D"]), hidden: 0 });
  });
  test("a long list keeps the first few on screen and counts the rest", () => {
    const { visible, hidden } = pickerLayout(twelve, "all", 4);
    expect(visible.map(option => option.label)).toEqual(["All", "Engineering", "Academic", "Performing Arts"]);
    expect(hidden).toBe(8);
  });
  test("a choice from the hidden part takes the last on-screen slot, so it is always visible", () => {
    const { visible, hidden } = pickerLayout(twelve, "media", 4);
    expect(visible.map(option => option.label)).toEqual(["All", "Engineering", "Academic", "Media"]);
    expect(hidden).toBe(8);
  });
  test("search matches every typed word, ignoring case and accents", () => {
    expect(matchOptions(twelve, "cafe").map(option => option.label)).toEqual(["Café Society"]);
    expect(matchOptions(twelve, "pre prof").map(option => option.label)).toEqual(["Pre-Professional"]);
    expect(matchOptions(twelve, "  ")).toHaveLength(12);
    expect(matchOptions(twelve, "zzz")).toEqual([]);
  });
  test("the sheet can list A to Z with the 'all' option kept first", () => {
    expect(sheetOrder(twelve, "all").map(option => option.label).slice(0, 4)).toEqual(["All", "Academic", "Café Society", "Cultural"]);
  });
});

function Harness({ options, initial = "all", deselectTo, onChange }: { options: PickerOption[]; initial?: string; deselectTo?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return <OptionPicker label="Category" testID="picker" options={options} value={value} deselectTo={deselectTo} moreLabel="All categories" onChange={next => { onChange?.(next); setValue(next); }} />;
}
const mount = (node: React.ReactNode) => render(
  <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}><ThemeProvider>{node}</ThemeProvider></SafeAreaProvider></GestureHandlerRootView>,
);

describe("the picker on screen", () => {
  test("wraps instead of scrolling sideways, with a More chip that counts what it hides", async () => {
    await mount(<Harness options={twelve} />);
    const row = screen.getByTestId("picker");
    expect(row.props.style).toEqual(expect.objectContaining({ flexDirection: "row", flexWrap: "wrap" }));
    expect(insideHorizontalScroll(row)).toBe(false);
    expect(screen.getByTestId("picker-engineering")).toBeTruthy();
    expect(screen.queryByTestId("picker-media")).toBeNull();
    expect(within(screen.getByTestId("picker-more")).getByText("+8")).toBeTruthy();
  });

  test("More opens a searchable list; picking from it closes the list and shows the choice on screen", async () => {
    const onChange = jest.fn();
    await mount(<Harness options={twelve} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("picker-more"));
    expect(screen.getByTestId("picker-sheet")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("picker-search"), "med");
    expect(screen.getByTestId("picker-sheet-media")).toBeTruthy();
    expect(screen.queryByTestId("picker-sheet-sports")).toBeNull();
    await fireEvent.press(screen.getByTestId("picker-sheet-media"));
    expect(onChange).toHaveBeenCalledWith("media");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(screen.getByTestId("picker-media").props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(loggedCrashes()).toEqual([]);
  });

  test("a search with no match says so", async () => {
    await mount(<Harness options={twelve} />);
    await fireEvent.press(screen.getByTestId("picker-more"));
    await fireEvent.changeText(screen.getByTestId("picker-search"), "zzz");
    expect(screen.getByText("Nothing matches “zzz”.")).toBeTruthy();
  });

  test("a short list has no search box in its sheet and no More chip at all", async () => {
    await mount(<Harness options={opts(["All", "A", "B", "C", "D"])} />);
    expect(screen.queryByTestId("picker-more")).toBeNull();
    expect(screen.getByTestId("picker-d")).toBeTruthy();
  });

  test("pressing the chosen chip again returns to All only where the screen asks for that", async () => {
    const onChange = jest.fn();
    await mount(<Harness options={twelve} initial="academic" deselectTo="all" onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("picker-academic"));
    expect(onChange).toHaveBeenLastCalledWith("all");
    onChange.mockClear();
    await mount(<Harness options={twelve} initial="academic" onChange={onChange} />);
    await fireEvent.press(screen.getAllByTestId("picker-academic").at(-1)!);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Explore categories", () => {
  const categories = ["Engineering", "Academic", "Performing Arts", "Pre-Professional", "Service", "Cultural", "Sports", "Religious", "Media", "Political"];
  const clubs = (records.fullClub ? [records.fullClub as PublicClub] : []).concat(categories.flatMap((category, index) =>
    Array.from({ length: categories.length - index }, (_, n) => ({ ...(records.fullClub as PublicClub), id: `00000000-0000-4000-8000-${String(index * 100 + n).padStart(12, "0")}`, name: `${category} club ${n + 1}`, category }))));

  test("the busiest categories show, the rest are one tap away, and a pick filters the list", async () => {
    await renderRoute(require("~/app/(tabs)/explore").default, { mode: "rich", overrides: { "explore.directory": { clubs } } });
    const row = screen.getByTestId("explore-category");
    expect(insideHorizontalScroll(row)).toBe(false);
    expect(screen.getByTestId("explore-category-all")).toBeTruthy();
    expect(screen.getByTestId("explore-category-engineering")).toBeTruthy();
    expect(screen.queryByTestId("explore-category-political")).toBeNull();
    await fireEvent.press(screen.getByTestId("explore-category-more"));
    await fireEvent.changeText(screen.getByTestId("explore-category-search"), "polit");
    await fireEvent.press(screen.getByTestId("explore-category-sheet-political"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(screenText(screen.toJSON())).toContain("1 club");
    expect(screen.getByTestId("explore-category-political").props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    // Pressing it again goes back to every club.
    await fireEvent.press(screen.getByTestId("explore-category-political"));
    expect(screenText(screen.toJSON())).toContain(`${clubs.length} clubs`);
    expect(loggedCrashes()).toEqual([]);
  });

  test("the usual directory still renders its categories without sideways scrolling", async () => {
    await renderRoute(require("~/app/(tabs)/explore").default, { mode: "rich" });
    expect(insideHorizontalScroll(screen.getByTestId("explore-category"))).toBe(false);
    expect(screen.getByTestId("explore-category-all")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("Calendar event types", () => {
  const event = (n: number, type: string, extra: Partial<AgendaEvent> = {}) => ({ ...(records.homeView as { agenda: AgendaEvent[] }).agenda[0]!, id: `event-${n}`, title: `Event ${n}`, type, ...extra });
  test("every type the person has wraps on screen, the rest behind More types", async () => {
    const events = [event(1, "Interview"), event(2, "Deadline"), event(3, "Interest Meeting"), event(4, "Coffee Chat"), event(5, "Other"), event(6, "Other", { id: "meeting-x" })];
    await renderRoute(require("~/app/(tabs)/calendar").default, { mode: "rich", overrides: { "calendar.view": { generatedAt: new Date().toISOString(), events } } });
    const row = screen.getByTestId("calendar-type");
    expect(insideHorizontalScroll(row)).toBe(false);
    expect(screen.getByTestId("calendar-type-all")).toBeTruthy();
    expect(screen.getByTestId("calendar-type-more")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("calendar-type-more"));
    await fireEvent.press(screen.getByTestId("calendar-type-sheet-coffee-chat"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(screen.getByTestId("calendar-type-coffee-chat").props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(screenText(screen.toJSON())).not.toContain("Event 1");
    expect(loggedCrashes()).toEqual([]);
  });

  test("the usual calendar's types fit on screen", async () => {
    await renderRoute(require("~/app/(tabs)/calendar").default, { mode: "rich" });
    expect(insideHorizontalScroll(screen.getByTestId("calendar-type"))).toBe(false);
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("other chip filters wrap too", () => {
  test.each([
    ["inbox", "inbox-type", {}],
    ["tasks", "tasks-filter", {}],
    ["leader/[clubId]/applicants", "applicants-round", { clubId: ids.leaderClub }],
  ] as const)("%s", async (file, testID, params) => {
    await renderRoute(require(`~/app/${file}`).default, { mode: "rich", params });
    expect(insideHorizontalScroll(screen.getByTestId(testID))).toBe(false);
    expect(loggedCrashes()).toEqual([]);
  });

  test("an applicants round picked from the list filters by that round", async () => {
    await renderRoute(require("~/app/leader/[clubId]/applicants").default, { mode: "rich", params: { clubId: ids.leaderClub } });
    expect(screen.getByTestId("applicants-round-all").props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    await fireEvent.press(screen.getByTestId(`applicants-round-${ids.round}`));
    expect(screen.getByTestId(`applicants-round-${ids.round}`).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(loggedCrashes()).toEqual([]);
  });
});
