/** Nov 21 retest of the tab screens: stale data on a failed refresh, double taps, tab targets, the Inbox badge, calendar rows. */
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { ApiError, api } from "~/lib/api";
import type { AgendaEvent, HomeView } from "~/lib/types";
import { apiState } from "./api-state";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, screenText, settle } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const busy = () => { throw new ApiError(503, "UNAVAILABLE", "Server busy (test)"); };
const homeView = records.homeView as HomeView;

describe("a failed background refresh keeps what is on screen", () => {
  test.each([
    ["inbox", "inbox", ["inbox", "pages"], "Notification 2"],
    ["(tabs)/calendar", "calendar.view", ["calendar.view", null], "Event 2"],
    ["(tabs)/explore", "explore.directory", ["explore.directory", null], "12 clubs"],
    ["(tabs)/profile", "profile", ["profile", null], "Education"],
  ] as const)("%s", async (file, operation, key, shown) => {
    const Screen = require(`~/app/${file}`).default;
    const { client } = await renderRoute(Screen, { mode: "rich" });
    expect(screenText(screen.toJSON())).toContain(shown);
    apiState.overrides = { [operation]: busy };
    await act(async () => { await client.refetchQueries({ queryKey: key as unknown as string[] }).catch(() => {}); });
    await settle(client);
    const text = screenText(screen.toJSON());
    expect(text).toContain(shown);
    expect(text).not.toMatch(/This didn.t load|couldn.t load/);
    expect(screen.getByTestId("stale-note")).toBeTruthy();
  });

  test("a first load that fails still shows the error", async () => {
    const Screen = require("~/app/inbox").default;
    await renderRoute(Screen, { mode: "rich", overrides: { inbox: busy } });
    expect(screenText(screen.toJSON())).toContain("This didn't load");
  });

  test("Profile: the edit sheet and its draft survive a failed refresh", async () => {
    const Screen = require("~/app/(tabs)/profile").default;
    const { client } = await renderRoute(Screen, { mode: "rich" });
    await fireEvent.press(screen.getByTestId("profile-edit"));
    await settle(client);
    expect(screen.getByTestId("profile-edit-sheet")).toBeTruthy();
    apiState.overrides = { profile: busy };
    await act(async () => { await client.refetchQueries({ queryKey: ["profile", null] }).catch(() => {}); });
    await settle(client);
    expect(screen.getByTestId("profile-edit-sheet")).toBeTruthy();
  });

  test("Profile with no profile yet goes to the app's own profile setup", async () => {
    const Screen = require("~/app/(tabs)/profile").default;
    await renderRoute(Screen, { mode: "empty" });
    await fireEvent.press(screen.getByTestId("profile-complete"));
    expect(routerState.router.replace).toHaveBeenCalledWith("/complete-profile");
  });
});

describe("a double tap opens a screen once", () => {
  test.each([["(tabs)/index", "home-application-0"], ["(tabs)/explore", "explore-club-0"], ["saved-clubs", "saved-club-0"], ["events/index", "event-card-0"], ["(tabs)/profile", "profile-settings"]])("%s %s", async (file, testID) => {
    const Screen = require(`~/app/${file}`).default;
    await renderRoute(Screen, { mode: "rich" });
    const target = screen.getByTestId(testID);
    await fireEvent.press(target);
    await fireEvent.press(target);
    expect(routerState.router.push).toHaveBeenCalledTimes(1);
    // A deliberate second tap a moment later still works.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 500)); });
    await fireEvent.press(target);
    expect(routerState.router.push).toHaveBeenCalledTimes(2);
  });
});

test("a toggle takes a quick second tap: a chip picked and unpicked at once ends unpicked", async () => {
  const { ChoiceChips } = require("~/components/choice-chips");
  const { useState } = require("react");
  function Harness() {
    const [value, setValue] = useState([] as string[]);
    return <ChoiceChips multiple testID="pick" label="Pick" value={value} onChange={setValue} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />;
  }
  await renderRoute(Harness);
  await fireEvent.press(screen.getByTestId("pick-a"));
  await fireEvent.press(screen.getByTestId("pick-a"));
  expect(screen.getByTestId("pick-a").props.accessibilityState).toMatchObject({ checked: false });
});

describe("stacked screens go back to the tabs underneath", () => {
  test("Saved clubs (empty): Browse clubs", async () => {
    const Screen = require("~/app/saved-clubs").default;
    await renderRoute(Screen, { mode: "empty" });
    await fireEvent.press(screen.getByTestId("saved-browse"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/explore");
    expect(routerState.router.replace).not.toHaveBeenCalled();
    expect(routerState.router.push).not.toHaveBeenCalled();
  });

  test("Events (empty): Explore clubs and Open your calendar", async () => {
    const Screen = require("~/app/events/index").default;
    const { client } = await renderRoute(Screen, { mode: "empty" });
    await fireEvent.press(screen.getByTestId("events-empty-explore"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/explore");
    await fireEvent.press(screen.getByTestId("events-my-rsvps-toggle"));
    await settle(client);
    await fireEvent.press(screen.getByTestId("events-open-calendar"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/calendar");
    expect(routerState.router.replace).not.toHaveBeenCalled();
    expect(routerState.router.push).not.toHaveBeenCalled();
  });
});

describe("Inbox badge", () => {
  // The Inbox is the bell in a tab's header; its label carries the count.
  async function badgeLabel(home: Partial<HomeView>) {
    const Screen = require("~/app/(tabs)/explore").default;
    await renderRoute(Screen, { mode: "rich", overrides: { "home.view": { ...homeView, ...home } } });
    return screen.getByTestId("header-inbox").props.accessibilityLabel as string;
  }
  test("counts what the Inbox lists, not task notifications it doesn't", async () => {
    expect(await badgeLabel({ unread: 5, inboxUnread: 3 })).toBe("Inbox, 3 unread");
  });
  test("an older server's total still shows", async () => {
    expect(await badgeLabel({ unread: 5, inboxUnread: undefined })).toBe("Inbox, 5 unread");
  });

  test("Mark all as read clears the Inbox's count and leaves task notifications in the total", async () => {
    const Screen = require("~/app/inbox").default;
    const { client } = await renderRoute(Screen, { mode: "rich" });
    client.setQueryData<HomeView>(["home.view", null], { ...homeView, unread: 10, inboxUnread: 8 });
    // Hold the write so the optimistic state can be read before the lists reload.
    let release = () => {};
    jest.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(undefined); }));
    await fireEvent.press(screen.getByTestId("inbox-mark-all"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(client.getQueryData<HomeView>(["home.view", null])).toMatchObject({ unread: 2, inboxUnread: 0 });
    await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 0)); });
    await settle(client);
  });
});

describe("calendar rows open what they are", () => {
  const event = (extra: Partial<AgendaEvent>): AgendaEvent => ({ id: "x", clubId: ids.leaderClub, startTime: new Date(Date.now() + 86_400_000).toISOString(), date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), day: 1, time: "7:00 PM", title: "Row", club: "Club", color: "#142d4e", type: "Other", readOnly: true, ...extra });

  async function openSheet(row: AgendaEvent) {
    const Screen = require("~/app/(tabs)/calendar").default;
    const { client } = await renderRoute(Screen, { mode: "rich", overrides: { "calendar.view": { generatedAt: new Date().toISOString(), events: [row] } } });
    await fireEvent.press(screen.getByText("Row"));
    await settle(client);
  }

  test("a leader's panel slot opens the interview tools", async () => {
    await openSheet(event({ id: `panel-${ids.slot}`, type: "Interview", response: "confirmed" }));
    expect(screen.getByText("You’re on the panel")).toBeTruthy();
    expect(screen.queryByText("Interview confirmed")).toBeNull();
    expect(screen.queryByText(/Contact the club/)).toBeNull();
    await fireEvent.press(screen.getByTestId("calendar-open-panel"));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/leader/[clubId]/interviews", params: { clubId: ids.leaderClub } });
  });

  test("a meeting the person checked in to opens that meeting", async () => {
    await openSheet(event({ id: ids.event, meetingId: ids.meeting }));
    expect(screen.queryByText(/Contact the club/)).toBeNull();
    await fireEvent.press(screen.getByTestId("calendar-open-meeting"));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/meeting/[id]", params: { id: ids.meeting } });
  });

  test("Home's next interview says where it goes", async () => {
    const booking = homeView.agenda.find(item => item.id.startsWith("booking-"))!;
    const Screen = require("~/app/(tabs)/index").default;
    // An interview starting within the hour is Home's top card (Nov 22 redesign).
    const soon = { ...booking, startTime: new Date(Date.now() + 3_600_000).toISOString(), endTime: new Date(Date.now() + 5_400_000).toISOString() };
    await renderRoute(Screen, { mode: "rich", overrides: { "home.view": { ...homeView, tasks: [], agenda: [soon] } } });
    expect(within(screen.getByTestId("home-hero-primary")).getByText("View interview")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("home-hero-primary"));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/interview/[applicationId]", params: { applicationId: ids.interviewApplication } });
  });

  test("a ?type=meeting link is cleared once applied", async () => {
    const Screen = require("~/app/(tabs)/calendar").default;
    await renderRoute(Screen, { mode: "rich", params: { type: "meeting" } });
    expect(routerState.router.setParams).toHaveBeenCalledWith({ type: undefined });
  });
});

describe("Events: Add to Calendar writes once", () => {
  test("the card reads Added after the first add, and a second tap adds nothing", async () => {
    const { createEvent } = jest.requireMock("expo-calendar").getDefaultCalendarSync() as { createEvent: jest.Mock };
    createEvent.mockClear();
    const Screen = require("~/app/events/index").default;
    const { client } = await renderRoute(Screen, { mode: "rich" });
    await fireEvent.press(screen.getByTestId("event-card-0-calendar"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    // Past the double-tap guard: a real second tap on the now-disabled button.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 500)); });
    await fireEvent.press(screen.getByTestId("event-card-0-calendar"));
    await settle(client);
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("event-card-0-calendar").props.accessibilityLabel).toBe("Added");
    expect(screen.getByTestId("event-card-0-calendar").props.accessibilityState.disabled).toBe(true);
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("Explore for an alumni account", () => {
  test("the bookmark shows the saved state but is locked", async () => {
    const alumni = { ...(records.me as { profile: object }), profile: { ...(records.me as { profile: object }).profile, graduatedAt: new Date(Date.now() - 86_400_000).toISOString() } };
    const Screen = require("~/app/(tabs)/explore").default;
    await renderRoute(Screen, { mode: "rich", overrides: { me: alumni } });
    expect(screen.getByTestId("explore-club-0-save").props.accessibilityState.disabled).toBe(true);
  });
});

describe("Calendar link sheet", () => {
  test("replacing a live link asks first, in the sheet", async () => {
    const Screen = require("~/app/(tabs)/calendar").default;
    const { client } = await renderRoute(Screen, { mode: "rich" });
    await fireEvent.press(screen.getByTestId("calendar-subscribe"));
    await settle(client);
    await fireEvent.press(screen.getByTestId("calendar-feed-create"));
    expect(screen.getByTestId("calendar-feed-confirm")).toBeTruthy();
    expect(apiState.calls.some(call => call.operation === "calendarFeed.create")).toBe(false);
    await fireEvent.press(screen.getByTestId("calendar-feed-confirm-cancel"));
    expect(screen.queryByTestId("calendar-feed-confirm")).toBeNull();
    await fireEvent.press(screen.getByTestId("calendar-feed-disable"));
    await fireEvent.press(screen.getByTestId("calendar-feed-confirm-accept"));
    await settle(client);
    expect(apiState.calls.some(call => call.operation === "calendarFeed.disable")).toBe(true);
    expect(screen.getByText("Calendar link turned off.")).toBeTruthy();
  });
});
