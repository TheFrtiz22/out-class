/**
 * Calendar: the Eastern Time line is gone, and a third view, Availability, edits the global weekly
 * schedule right on the Calendar with the same editor and autosave as Settings → Availability.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { apiState } from "./api-state";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

type Saved = { revision: number; accountId?: string; schedule: { weekly: [number, number][][]; weeklySubmitted: boolean; exceptions: Record<string, [number, number][]> } };
const Screen = () => require("~/app/(tabs)/calendar").default;
const saves = () => apiState.calls.filter(call => call.method === "POST" && call.operation === "availability.save").map(call => call.input as Saved);
const checked = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.checked;
const press = async (testID: string) => { await fireEvent.press(screen.getByTestId(testID)); };
const openAvailability = async (client: Parameters<typeof settle>[0]) => { await fireEvent.press(screen.getByText("Availability")); await settle(client); };
async function autosave(client: Parameters<typeof settle>[0]) {
  await act(() => new Promise(resolve => setTimeout(resolve, 950)));
  await settle(client);
}

describe("calendar views", () => {
  test("no Eastern Time line, and the view switch offers Agenda, Month and Availability", async () => {
    await renderRoute(Screen());
    expect(screen.queryByText(/Eastern Time/)).toBeNull();
    const tabs = screen.getAllByRole("tab").map(tab => tab.props.accessibilityLabel);
    expect(tabs).toEqual(expect.arrayContaining(["Agenda", "Month", "Availability"]));
    expect(screen.queryByTestId("calendar-availability")).toBeNull();
    expect(screen.queryByTestId("header-backdrop")).toBeNull();
  });

  test("Availability shows the editor in place of events, and Agenda brings the events back", async () => {
    const { client } = await renderRoute(Screen());
    expect(screen.getByText("Event 2")).toBeTruthy();
    await openAvailability(client);
    expect(screen.getByTestId("calendar-availability")).toBeTruthy();
    expect(screen.getByTestId("availability-editor")).toBeTruthy();
    expect(apiState.calls.some(call => call.operation === "availability.mine")).toBe(true);
    expect(screen.queryByText("Event 2")).toBeNull();
    expect(screen.queryByTestId("calendar-include-past")).toBeNull();
    expect(screen.queryByText("Nothing coming up")).toBeNull();
    expect(screen.getByTestId("header-backdrop")).toBeTruthy();
    await fireEvent.press(screen.getByText("Agenda"));
    expect(screen.getByText("Event 2")).toBeTruthy();
    expect(screen.queryByTestId("availability-editor")).toBeNull();
  });

  test("an empty calendar still offers Availability", async () => {
    const { client } = await renderRoute(Screen(), { mode: "empty" });
    expect(screen.getByText("Nothing coming up")).toBeTruthy();
    await openAvailability(client);
    expect(screen.getByTestId("availability-editor")).toBeTruthy();
    expect(screen.queryByText("Nothing coming up")).toBeNull();
    await press("availability-submit-week");
    await autosave(client);
    expect(saves()[0]).toMatchObject({ revision: 0, schedule: { weeklySubmitted: true } });
  });
});

describe("editing availability from the Calendar", () => {
  test("a tapped quarter hour autosaves to the global schedule with the loaded revision", async () => {
    const { client } = await renderRoute(Screen());
    await openAvailability(client);
    await press("availability-day-0");
    expect(checked("availability-grid-slot-36")).toBe(true); // Monday 9:00 AM
    await press("availability-grid-slot-32");
    expect(screen.getByTestId("availability-save-state").props.children).toBe("Unsaved changes");
    await autosave(client);
    expect(saves()[0]).toMatchObject({ revision: 2, accountId: ids.user });
    expect(saves()[0].schedule.weekly[0]).toEqual([[480, 495], [540, 720]]);
    expect(screen.getByTestId("availability-save-state").props.children).toBe("Saved");
    // Settings → Availability reads the same cache, so it opens on the saved week.
    expect(client.getQueryData<{ document: { revision: number } }>(["availability.mine", null])?.document.revision).toBe(3);
    expect(loggedCrashes()).toEqual([]);
  });

  test("dragging paints a range, and the list scrolls again afterwards", async () => {
    const { client } = await renderRoute(Screen());
    await openAvailability(client);
    await press("availability-day-2");
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
    expect(screen.getByTestId("calendar-screen").props.scrollEnabled).not.toBe(false);
    await autosave(client);
    expect(saves().at(-1)!.schedule.weekly[2]).toEqual([[540, 600], [840, 1020]]);
  });

  test("specific dates work here too", async () => {
    const { client } = await renderRoute(Screen());
    await openAvailability(client);
    await press("availability-day-0");
    await fireEvent.press(screen.getByText("Specific dates"));
    await press("availability-next-week");
    await press("availability-grid-slot-32");
    await autosave(client);
    const saved = saves().at(-1)!.schedule;
    expect(saved.weekly[0]).toEqual([[540, 720]]);
    expect(Object.values(saved.exceptions)).toEqual([[[480, 495], [540, 720]]]);
  });

  test("a week saved from Settings while the Calendar stays open is picked up, so the next edit isn't refused as stale", async () => {
    const { client } = await renderRoute(Screen());
    await openAvailability(client);
    await press("availability-day-0");
    expect(checked("availability-grid-slot-36")).toBe(true);
    // Settings' editor saved revision 7 (Monday cleared) into the shared cache.
    await act(async () => {
      client.setQueryData<{ document: { accountId: string; revision: number; schedule: object } }>(["availability.mine", null], old => old && {
        ...old, document: { ...old.document, revision: 7, schedule: { timezone: "America/New_York", weekly: [[], [], [[840, 1020]], [], [], [], []], weeklySubmitted: true, exceptions: {} } },
      });
    });
    await settle(client);
    await press("availability-day-0");
    expect(checked("availability-grid-slot-36")).toBe(false);
    await press("availability-grid-slot-32");
    await autosave(client);
    expect(saves().at(-1)).toMatchObject({ revision: 7 });
    expect(saves().at(-1)!.schedule.weekly[0]).toEqual([[480, 495]]);
    // Its own save doesn't start the editor over: the next edit goes with the revision it got back.
    await press("availability-grid-slot-33");
    await autosave(client);
    expect(saves().at(-1)).toMatchObject({ revision: 8 });
    expect(saves().at(-1)!.schedule.weekly[0]).toEqual([[480, 510]]);
    expect(loggedCrashes()).toEqual([]);
  });

  test("Club interview rounds opens Settings → Availability", async () => {
    const { client } = await renderRoute(Screen());
    await openAvailability(client);
    await press("calendar-availability-rounds");
    expect(routerState.router.push).toHaveBeenCalledWith("/settings/availability");
  });

  test("alumni see their week read-only with the reason", async () => {
    const alumniMe = { ...records.me, profile: { ...records.me.profile!, graduatedAt: "2025-05-20T12:00:00.000Z" } };
    const { client } = await renderRoute(Screen(), { overrides: { me: alumniMe } });
    await openAvailability(client);
    expect(screen.getByText("Alumni accounts can’t edit availability. Your saved availability stays as it is.")).toBeTruthy();
    expect(screen.queryByTestId("availability-save-state")).toBeNull();
    expect(screen.getByTestId("availability-grid-slot-36").props.accessibilityState).toMatchObject({ disabled: true });
  });

  test("a failed availability load shows a retry instead of the editor", async () => {
    const { client } = await renderRoute(Screen(), { overrides: { "availability.mine": () => { throw new Error("test refusal"); } } });
    await openAvailability(client);
    expect(screen.queryByTestId("availability-editor")).toBeNull();
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});
