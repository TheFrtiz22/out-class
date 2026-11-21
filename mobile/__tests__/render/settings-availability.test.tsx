/**
 * Settings → Availability works in the app against the web's own operations (actions/availability.ts):
 * the global week autosaves with the loaded revision, and a round's response is submitted, withdrawn
 * or declined the way the web's editor does it.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { ApiError } from "~/lib/api";
import { apiState } from "./api-state";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

type Schedule = { weekly: [number, number][][]; weeklySubmitted: boolean; exceptions: Record<string, [number, number][]> };
type Saved = { revision: number; schedule: Schedule; accountId?: string; confirm?: boolean; clubId?: string; roundId?: string };
const posts = (operation: string) => apiState.calls.filter(call => call.method === "POST" && call.operation === operation).map(call => call.input as Saved);
const alumniMe = { ...records.me, profile: { ...records.me.profile!, graduatedAt: "2025-05-20T12:00:00.000Z" } };
const Screen = () => require("~/app/settings/availability").default;
const checked = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.checked;
/** Lets the 850 ms autosave debounce run, then waits for the save. */
async function autosave(client: Parameters<typeof settle>[0]) {
  await act(() => new Promise(resolve => setTimeout(resolve, 950)));
  await settle(client);
}
const press = async (testID: string) => { await fireEvent.press(screen.getByTestId(testID)); };

describe("settings overview", () => {
  test("Availability opens in the app, not on the web", async () => {
    await renderRoute(require("~/app/settings/index").default);
    await press("settings-availability");
    expect(routerState.router.push).toHaveBeenCalledWith("/settings/availability");
  });
});

describe("global availability", () => {
  test("shows the saved week and autosaves a tapped quarter hour with the loaded revision", async () => {
    const { client } = await renderRoute(Screen());
    expect(screen.getByText("Your weekly rhythm")).toBeTruthy();
    expect(screen.getByTestId("availability-save-state").props.children).toBe("All changes saved");
    await press("availability-day-0");
    expect(checked("availability-grid-slot-36")).toBe(true); // Monday 9:00 AM
    expect(checked("availability-grid-slot-32")).toBe(false);
    await press("availability-grid-slot-32");
    expect(checked("availability-grid-slot-32")).toBe(true);
    expect(screen.getByTestId("availability-save-state").props.children).toBe("Unsaved changes");
    await autosave(client);
    const [first] = posts("availability.save");
    expect(first).toMatchObject({ revision: 2, accountId: ids.user });
    expect(first.schedule.weekly[0]).toEqual([[480, 495], [540, 720]]);
    expect(screen.getByTestId("availability-save-state").props.children).toBe("All changes saved");
    // The next edit is sent with the revision the server returned.
    await press("availability-grid-slot-33");
    await autosave(client);
    expect(posts("availability.save")[1]).toMatchObject({ revision: 3 });
    expect(posts("availability.save")[1].schedule.weekly[0]).toEqual([[480, 510], [540, 720]]);
    expect(loggedCrashes()).toEqual([]);
  });

  test("tapping an hour fills it, and dragging paints a range", async () => {
    const { client } = await renderRoute(Screen());
    await press("availability-day-2"); // Wednesday, 2–5 PM saved
    await press("availability-grid-hour-32");
    expect([32, 33, 34, 35].map(slot => checked(`availability-grid-slot-${slot}`))).toEqual([true, true, true, true]);
    // Each hour row is 44 high with a 4 gap; columns start after the 58-wide hour label.
    await fireEvent(screen.getByTestId("availability-grid-rows"), "layout", { nativeEvent: { layout: { width: 358, height: 620, x: 0, y: 0 } } });
    await act(async () => {
      fireGestureHandler(getByGestureTestId("availability-grid-paint"), [
        { state: State.BEGAN, x: 70, y: 60 }, // 9:00 AM
        { state: State.ACTIVE, x: 70, y: 60 },
        { x: 340, y: 80 },
        { state: State.END, x: 340, y: 80 }, // 9:45 AM
      ]);
    });
    expect([36, 37, 38, 39].map(slot => checked(`availability-grid-slot-${slot}`))).toEqual([true, true, true, true]);
    // The tap that ends the drag doesn't undo the quarter hour it started on, and the page scrolls again.
    await press("availability-grid-slot-36");
    expect(checked("availability-grid-slot-36")).toBe(true);
    expect(screen.getByTestId("settings-availability-screen").props.scrollEnabled).not.toBe(false);
    await autosave(client);
    expect(posts("availability.save").at(-1)!.schedule.weekly[2]).toEqual([[480, 600], [840, 1020]]);
  });

  test("copies a day to other days and clears the week", async () => {
    const { client } = await renderRoute(Screen());
    await press("availability-day-0");
    await press("availability-copy-day");
    expect(screen.getByText("Copy Monday to")).toBeTruthy();
    expect(screen.getByTestId("availability-copy-confirm").props.accessibilityState).toMatchObject({ disabled: true });
    await press("availability-copy-to-1");
    await press("availability-copy-to-4");
    expect(screen.getByText("Copy to 2 days")).toBeTruthy();
    await press("availability-copy-confirm");
    await autosave(client);
    const copied = posts("availability.save").at(-1)!.schedule.weekly;
    expect([copied[1], copied[4]]).toEqual([[[540, 720]], [[540, 720]]]);
    await act(() => new Promise(resolve => setTimeout(resolve, 460))); // Button's double-tap guard
    await press("availability-clear-week");
    await autosave(client);
    const cleared = posts("availability.save").at(-1)!.schedule;
    expect(cleared.weekly).toEqual([[], [], [], [], [], [], []]);
    expect(cleared.weeklySubmitted).toBe(true);
  });

  test("specific dates edit one week and leave the recurring week alone", async () => {
    const { client } = await renderRoute(Screen());
    await press("availability-day-0");
    await fireEvent.press(screen.getByText("Specific dates"));
    expect(screen.getByTestId("availability-week")).toBeTruthy();
    await press("availability-next-week");
    await press("availability-grid-slot-32");
    await autosave(client);
    const saved = posts("availability.save").at(-1)!.schedule;
    expect(saved.weekly[0]).toEqual([[540, 720]]);
    expect(Object.values(saved.exceptions)).toEqual([[[480, 495], [540, 720]]]);
    expect(screen.getByTestId("availability-use-recurring")).toBeTruthy();
  });

  test("a new account submits an empty recurring week", async () => {
    const { client } = await renderRoute(Screen(), { mode: "empty" });
    expect(screen.getByTestId("availability-save-state").props.children).toBe("No schedule saved");
    expect(screen.getByTestId("availability-day-0").props.accessibilityLabel).toContain("Not submitted");
    await press("availability-submit-week");
    await autosave(client);
    expect(posts("availability.save")[0]).toMatchObject({ revision: 0, schedule: { weeklySubmitted: true, weekly: [[], [], [], [], [], [], []] } });
    expect(screen.queryByTestId("availability-submit-week")).toBeNull();
  });

  test("a save refused because the week changed elsewhere keeps the edit and offers a reload", async () => {
    const { client } = await renderRoute(Screen(), { overrides: { "availability.save": () => { throw new ApiError(409, "STALE", "Availability changed in another tab. Reload before saving again."); } } });
    await press("availability-day-0");
    await press("availability-grid-slot-32");
    await autosave(client);
    expect(screen.getByText("Availability changed in another tab. Reload before saving again.")).toBeTruthy();
    expect(screen.getByTestId("availability-save-state").props.children).toBe("Save failed · edits retained");
    expect(checked("availability-grid-slot-32")).toBe(true);
    expect(screen.queryByText("Retry save")).toBeNull();
    await press("availability-reload");
    await settle(client);
    expect(apiState.calls.filter(call => call.operation === "availability.mine").length).toBeGreaterThanOrEqual(2);
  });

  test("alumni see their week read-only", async () => {
    await renderRoute(Screen(), { overrides: { me: alumniMe } });
    expect(screen.getByText("Alumni accounts can’t edit availability. Your saved availability stays as it is.")).toBeTruthy();
    expect(screen.queryByTestId("availability-save-state")).toBeNull();
    expect(screen.queryByTestId("availability-clear-week")).toBeNull();
    expect(screen.getByTestId("availability-grid-slot-36").props.accessibilityState).toMatchObject({ disabled: true });
  });

  test("a failed load shows the reason and a retry", async () => {
    await renderRoute(Screen(), { mode: "error" });
    expect(screen.getByText(/test refusal/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});

describe("round availability", () => {
  async function openRound() {
    const rendered = await renderRoute(Screen());
    await press("availability-round-picker");
    await press(`availability-round-${ids.round}`);
    await settle(rendered.client);
    return rendered;
  }

  test("the picker lists each round with its response and opens the round's own week", async () => {
    const { client } = await renderRoute(Screen());
    await press("availability-round-picker");
    expect(screen.getByText("Virginia Motorsports · First round interviews · Awaiting response")).toBeTruthy();
    expect(checked("availability-round-global")).toBe(true);
    await press(`availability-round-${ids.round}`);
    await settle(client);
    expect(apiState.calls.some(call => call.operation === "availability.round" && (call.input as { roundId: string }).roundId === ids.round)).toBe(true);
    expect(screen.getByText("This response belongs only to this club and round. It does not change your global schedule.")).toBeTruthy();
  });

  test("submits the round, which confirms participation", async () => {
    const { client } = await openRound();
    expect(screen.getByText("First round interviews")).toBeTruthy();
    expect(screen.getByText("Week of Nov 23, 2026")).toBeTruthy();
    expect(screen.getByText(/^Not submitted for this round/)).toBeTruthy();
    await press("availability-submit-round");
    await settle(client);
    expect(posts("availability.round.save").at(-1)).toMatchObject({ clubId: ids.memberClub, roundId: ids.round, revision: 1, confirm: true });
    expect(screen.getByText(/^Submitted · Participation confirmed/)).toBeTruthy();
    expect(screen.getByText("Update submitted availability")).toBeTruthy();
    expect(screen.getByTestId("availability-round-picker").props.accessibilityLabel).toContain("First round interviews · Submitted");
    await act(() => new Promise(resolve => setTimeout(resolve, 460)));
    await press("availability-withdraw");
    await settle(client);
    expect(posts("availability.round.save").at(-1)).toMatchObject({ revision: 2, confirm: false });
    expect(screen.getByText(/^Not submitted for this round/)).toBeTruthy();
  });

  test("declines participation with the loaded revision", async () => {
    const { client } = await openRound();
    await press("availability-decline");
    await settle(client);
    expect(posts("availability.round.decline")).toEqual([{ clubId: ids.memberClub, roundId: ids.round, revision: 1, accountId: ids.user }]);
    expect(screen.getByText(/^Declined participation/)).toBeTruthy();
    expect(screen.getByTestId("availability-round-picker").props.accessibilityLabel).toContain("Declined participation");
  });

  test("an edit to a date in the round autosaves without confirming", async () => {
    const { client } = await openRound();
    await press("availability-day-1"); // Tue Nov 24 has a 10–11 AM date change
    expect(checked("availability-grid-slot-40")).toBe(true);
    await press("availability-grid-slot-41");
    await autosave(client);
    const saved = posts("availability.round.save").at(-1)!;
    expect(saved).toMatchObject({ confirm: false, revision: 1 });
    expect(saved.schedule.exceptions["2026-11-24"]).toEqual([[600, 615], [630, 660]]);
  });
  test("after submitting, reopening the round keeps the new revision", async () => {
    const { client } = await openRound();
    await press("availability-submit-round");
    await settle(client);
    await act(() => new Promise(resolve => setTimeout(resolve, 460)));
    await press("availability-round-picker");
    await press("availability-round-global");
    await settle(client);
    await press("availability-round-picker");
    await press(`availability-round-${ids.round}`);
    await settle(client);
    await press("availability-decline");
    await settle(client);
    expect(posts("availability.round.decline").at(-1)).toMatchObject({ revision: 2 });
    expect(loggedCrashes()).toEqual([]);
  });

  test("restoring a device copy of a submitted round takes it back to not submitted", async () => {
    const { readDocument } = require("~/lib/availability");
    const loaded = readDocument({ accountId: ids.user, revision: 1, schedule: { timezone: "America/New_York", weekly: [[[540, 720]], [], [[840, 1020]], [], [], [], []], weeklySubmitted: true, exceptions: { "2026-11-24": [[600, 660]] } } }).schedule;
    const mine = { ...loaded, exceptions: { ...loaded.exceptions, "2026-11-25": [[600, 630]] } };
    await AsyncStorage.setItem(`outclass:draft:v1:${ids.user}:availability:${ids.memberClub}:${ids.round}`, JSON.stringify({ value: mine, baseline: JSON.stringify(loaded), at: Date.now() }));
    const { client } = await renderRoute(Screen(), { overrides: { "availability.round": () => ({ preferredWeek: "2026-11-23", name: "First round interviews", confirmed: true, declined: false, global: loaded, document: { accountId: ids.user, revision: 1, schedule: loaded } }) } });
    await press("availability-round-picker");
    await press(`availability-round-${ids.round}`);
    await settle(client);
    expect(screen.getByText(/^Submitted · Participation confirmed/)).toBeTruthy();
    await press("availability-restore");
    await autosave(client);
    expect(screen.getByText(/^Not submitted for this round/)).toBeTruthy();
    expect(posts("availability.round.save").at(-1)).toMatchObject({ confirm: false, revision: 1 });
    await AsyncStorage.clear();
  });
});

