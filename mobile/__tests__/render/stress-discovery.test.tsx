/**
 * Nov 24 pre-launch stress pass of student discovery and Home: Home, Explore, a club's profile, Saved clubs,
 * the Events board and an event, My clubs and My club. Scale (hundreds of rows, long, empty, emoji and RTL
 * text), network (failed refreshes, a server's soft error, rollbacks, double taps), navigation (bad and
 * array params), time (Eastern, midnight, the Nov 1 2026 and Mar 14 2027 clock changes) and exposure.
 *
 * Tests named "D<n>" demonstrate a finding and FAIL until it is fixed; the rest are checks that passed
 * at scale and are kept as regressions.
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HomeHeroCard, whenLabel } from "~/components/home/home-sections";
import { clubRecruitment, emptyDirectoryFilters, eventScheduleLabel, filterDirectory, rankedCategories } from "~/components/explore/directory";
import { ApiError, api } from "~/lib/api";
import { AuthProvider } from "~/lib/auth";
import { homeLayout } from "~/lib/home-priority";
import { ThemeProvider } from "~/lib/theme";
import type { AgendaEvent, CalendarEvent, CampusEvent, EventBoard, HomeView, Me, Membership, PublicClub, TaskNotification } from "~/lib/types";
import { apiState, resetApi } from "./api-state";
import { ids, longName, records } from "./fixtures";
import { captureConsole, loggedCrashes, makeQueryClient, releaseConsole, renderRoute, screenText, settle } from "./harness";
import { resetRouter, routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const route = (file: string) => require(`~/app/${file}`).default;
const busy = () => { throw new ApiError(503, "UNAVAILABLE", "Server busy (test)"); };
const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const uuid = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;
const fullClub = records.fullClub as PublicClub;
const homeView = records.homeView as HomeView;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---- Data at scale ------------------------------------------------------------------------------
const CATEGORIES = ["Engineering", "Academic", "Performing Arts", "Pre-Professional", "Cultural", "Service"];
const NAMES = ["Robotics", "Debate", "A Cappella", "Finance", "Société Française", "🚀 Rocketry", "نادي الطلاب العرب", "", "x".repeat(300)];
function club(n: number, extra: Partial<PublicClub> = {}): PublicClub {
  return {
    ...fullClub, id: uuid(n), name: `Club ${n} ${NAMES[n % NAMES.length]}`, category: CATEGORIES[n % CATEGORIES.length]!,
    pitch: n % 5 ? `Pitch ${n}` : "", description: n % 7 ? "We build, debate and sing. ".repeat(n % 40) : "", marketing: n % 4 ? { placements: n % 8 ? [] : ["Tesla"] } : null,
    acceptanceRate: n % 3 ? (n % 100) : null, applicationAvailable: n % 2 === 0, applicationDeadline: n % 6 ? new Date(Date.now() + ((n % 30) - 5) * DAY).toISOString() : null,
    publicEvents: [], logoUrl: null, bannerUrl: null, ...extra,
  };
}
const clubs600 = Array.from({ length: 600 }, (_, index) => club(index + 1));
const campusEvent = records.campusEvent as (n: number, extra?: Partial<CampusEvent>) => CampusEvent;

/** The app's real providers, rendered without waiting for every query to settle (for a response held open). */
async function renderUnsettled(Screen: React.ComponentType, params: Record<string, string>, seed: (client: QueryClient) => void, pending: string[]) {
  resetApi("rich");
  resetRouter(params);
  const target = api as { get: typeof api.get };
  const original = target.get;
  target.get = ((operation: string, input?: unknown, options?: unknown) => pending.includes(operation) ? new Promise(() => {}) : (original as (...args: unknown[]) => Promise<unknown>)(operation, input, options)) as typeof api.get;
  const client = makeQueryClient();
  seed(client);
  const tree: ReactNode = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } }}>
        <QueryClientProvider client={client}><ThemeProvider><AuthProvider><Screen /></AuthProvider></ThemeProvider></QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
  await render(tree);
  await wait(50);
  return { restore: () => { target.get = original; } };
}
const themed = (node: ReactNode) => render(
  <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } }}><ThemeProvider>{node}</ThemeProvider></SafeAreaProvider></GestureHandlerRootView>,
);

// =================================================================================================
// Findings (each fails until fixed)
// =================================================================================================

describe("D1: what the hero card shows is listed again in its own section", () => {
  // docs/mobile/home-priority.md: "Whatever is in the card is left out of the section below it, so it is never shown twice."
  test("D1 a task in the hero is not repeated under Tasks", async () => {
    await renderRoute(route("(tabs)/index"), { mode: "rich" });
    const title = (homeView.tasks[0] as TaskNotification).title;
    expect(within(screen.getByTestId("home-hero")).getByText(title)).toBeTruthy();
    expect(within(screen.getByTestId("home-tasks")).queryByText(title)).toBeNull();
  });

  test("D1 a draft in the hero is not repeated under Applications", async () => {
    await renderRoute(route("(tabs)/index"), { mode: "rich", overrides: { "home.view": { ...homeView, tasks: [] } } });
    expect(within(screen.getByTestId("home-hero")).getByText(`Finish your ${longName} application`)).toBeTruthy();
    expect(within(screen.getByTestId("home-applications")).queryByText(longName)).toBeNull();
  });
});

describe("D2: Coming Up shows an empty card when its only event is in the hero", () => {
  test("D2 the section hides instead of drawing a heading over an empty card", async () => {
    const soon = { ...(homeView.agenda[1] as AgendaEvent), id: "meeting-only-one", type: "Other", allDay: false, startTime: new Date(Date.now() + HOUR).toISOString(), endTime: new Date(Date.now() + 2 * HOUR).toISOString() };
    await renderRoute(route("(tabs)/index"), { mode: "rich", overrides: { "home.view": { ...homeView, agenda: [soon], tasks: [], applications: [] } } });
    expect(within(screen.getByTestId("home-hero")).getByText(soon.title)).toBeTruthy();
    expect(screen.queryByTestId("home-coming-up")).toBeNull();
  });
});

describe("D3: the hero calls an event after midnight 'Today'", () => {
  test("D3 10:30 PM Eastern, a meeting at 12:30 AM: the eyebrow is not 'Today'", async () => {
    const now = new Date("2026-11-24T03:30:00Z"); // Mon Nov 23, 10:30 PM Eastern
    const event: CalendarEvent = { id: "meeting-late", clubId: ids.memberClub, startTime: "2026-11-24T05:30:00Z", endTime: "2026-11-24T06:30:00Z", date: "", day: 24, time: "", title: "Late-night build session", club: "Virginia Motorsports", color: "#E57200", type: "Other" };
    const hero = homeLayout({ now, applications: [], agenda: [event], tasks: [] }).hero!;
    expect(hero.kind).toBe("event");
    await themed(<HomeHeroCard hero={hero} now={now} onOpen={() => {}} eventRoute={() => ({ pathname: "/calendar" })} eventAction={() => "View calendar"} taskRoute={() => ({ pathname: "/tasks" })} />);
    expect(screen.queryByText("Today")).toBeNull();
  });
});

describe("D4: 'Tomorrow' is worked out as now + 24 hours, wrong on the days the clocks change", () => {
  test("D4 just after midnight on Nov 1 2026 (clocks go back), a 9 AM meeting on Nov 2 is 'Tomorrow'", () => {
    const now = new Date("2026-11-01T04:30:00Z"); // Sun Nov 1, 12:30 AM EDT
    expect(whenLabel("2026-11-02T14:00:00Z", now)).toBe("Tomorrow, 9:00 AM");
  });
  test("D4 late on Mar 13 2027 (clocks go forward), a 9 AM meeting on Mar 15 is not 'Tomorrow'", () => {
    const now = new Date("2027-03-14T04:30:00Z"); // Sat Mar 13, 11:30 PM EST
    expect(whenLabel("2027-03-15T13:00:00Z", now)).not.toMatch(/^Tomorrow/);
    expect(whenLabel("2027-03-14T13:00:00Z", now)).toBe("Tomorrow, 9:00 AM");
  });
});

describe("D5: the Events board drops a loaded list when a later request fails", () => {
  test("D5 a failed background refresh keeps the events on screen", async () => {
    const { client } = await renderRoute(route("events/index"), { mode: "rich" });
    expect(screen.getByTestId("event-card-0")).toBeTruthy();
    apiState.overrides = { "events.board": busy };
    await act(async () => { await client.refetchQueries({ queryKey: ["events.board"] }).catch(() => {}); });
    await settle(client);
    expect(screen.queryByTestId("event-card-0")).toBeTruthy();
    expect(screenText(screen.toJSON())).not.toMatch(/couldn.t load|didn.t load/i);
  });

  test("D5 a failed next page keeps the pages already loaded", async () => {
    const { client } = await renderRoute(route("events/index"), { mode: "rich" });
    apiState.overrides = { "events.board": (input: unknown) => (input as { page: number }).page > 0 ? busy() : { events: [campusEvent(1)], clubs: [], total: 61, hasMore: true } };
    await act(async () => { fireEvent(screen.getByTestId("events-screen"), "onEndReached"); });
    await settle(client);
    expect(screen.queryByTestId("event-card-0")).toBeTruthy();
  });
});

describe("D6: a server's soft error on a background refresh replaces a loaded screen", () => {
  // getClubDirectory and getPublicClub catch every failure and answer 200 with { error } (actions/club-directory.ts).
  test("D6 Explore keeps its clubs when a refresh answers { clubs: [], error }", async () => {
    const { client } = await renderRoute(route("(tabs)/explore"), { mode: "rich" });
    expect(screen.getByTestId("explore-count").props.children.join("")).toBe("12 clubs");
    apiState.overrides = { "explore.directory": { clubs: [], error: "We couldn’t load the club directory. Please try again." } };
    await act(async () => { await client.refetchQueries({ queryKey: ["explore.directory"] }); });
    await settle(client);
    expect(screen.queryByTestId("explore-club-0")).toBeTruthy();
  });

  test("D6 a club's page stays when a refresh answers { club: null, error }", async () => {
    const { client } = await renderRoute(route("club/[id]"), { mode: "rich", params: { id: fullClub.id } });
    expect(screen.getByTestId("club-name")).toBeTruthy();
    apiState.overrides = { club: { club: null, error: "We couldn’t load this club. Please try again." } };
    await act(async () => { await client.refetchQueries({ queryKey: ["club"] }); });
    await settle(client);
    expect(screen.queryByTestId("club-name")).toBeTruthy();
  });
});

describe("D7: Explore's search leaves out where a club meets", () => {
  // The web's filterDirectory (lib/club-directory.ts) also matches each public event's location.
  test("D7 searching a building finds the club whose public event is there", () => {
    const withEvent = club(1, { publicEvents: [{ id: ids.event, title: "Info session", date: new Date(Date.now() + DAY).toISOString(), location: "Thornton Hall", description: null }] });
    expect(filterDirectory([withEvent, club(2)], { ...emptyDirectoryFilters, query: "thornton" }).map(item => item.id)).toEqual([withEvent.id]);
  });
});

describe("D8: categories that differ only in case are separate chips whose counts disagree with the results", () => {
  test("D8 each chip's count equals the clubs it shows", () => {
    const list = [club(1, { category: "Pre-Professional" }), club(2, { category: "Pre-Professional" }), club(3, { category: "Pre-professional" })];
    const chips = rankedCategories(list);
    for (const chip of chips) expect(chip.count).toBe(filterDirectory(list, { ...emptyDirectoryFilters, category: chip.category }).length);
  });
});

describe("D9: the Events search sends more than the server accepts", () => {
  // lib/campus-event-schemas.ts: query is at most 200 characters; a longer one is refused and the board shows an error.
  test("D9 a pasted 250-character search is capped before it is sent", async () => {
    const { client } = await renderRoute(route("events/index"), { mode: "rich" });
    await fireEvent.changeText(screen.getByTestId("events-search"), "robotics ".repeat(28));
    await wait(300);
    await settle(client);
    const sent = apiState.calls.filter(call => call.operation === "events.board").map(call => (call.input as { query: string }).query.length);
    expect(Math.max(...sent)).toBeLessThanOrEqual(200);
  });
});

describe("D11: Explore's search is accent-sensitive", () => {
  test("D11 'societe' finds 'Société Française' (same on the web)", () => {
    expect(filterDirectory([club(4)], { ...emptyDirectoryFilters, query: "societe francaise" })).toHaveLength(1);
  });
});

describe("D12: two club links with the same address share a React key", () => {
  test("D12 no duplicate-key warning on a club page whose links repeat an address", async () => {
    const links = [{ label: "Website", url: "https://example.edu/club" }, { label: "Apply on our site", url: "https://example.edu/club" }];
    await renderRoute(route("club/[id]"), { mode: "rich", params: { id: fullClub.id }, overrides: { club: { club: { ...fullClub, marketing: { ...fullClub.marketing, links } } } } });
    const warnings = (console.error as jest.Mock).mock.calls.map(args => args.join(" ")).filter(line => /same key/.test(line));
    expect(warnings).toEqual([]);
  });
});

// =================================================================================================
// Checked at scale and fine (kept as regressions)
// =================================================================================================

describe("Explore at scale", () => {
  test("600 clubs with long, empty, emoji and RTL names: renders, counts them, and virtualizes the list", async () => {
    const started = Date.now();
    await renderRoute(route("(tabs)/explore"), { mode: "rich", overrides: { "explore.directory": { clubs: clubs600 } } });
    expect(screen.getByTestId("explore-count").props.children.join("")).toBe("600 clubs");
    expect(screen.queryAllByTestId(/^explore-club-\d+$/).length).toBeLessThan(30);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(loggedCrashes()).toEqual([]);
  });

  test("search ignores case and extra spaces, and combined with a category matches a brute-force filter", () => {
    const a = filterDirectory(clubs600, { ...emptyDirectoryFilters, query: "robotics" });
    expect(filterDirectory(clubs600, { ...emptyDirectoryFilters, query: "   ROBOTICS  " }).map(c => c.id)).toEqual(a.map(c => c.id));
    expect(a.length).toBeGreaterThan(0);
    for (const category of CATEGORIES) {
      const both = filterDirectory(clubs600, { ...emptyDirectoryFilters, query: "club robotics", category });
      const expected = clubs600.filter(c => c.category === category && /club/i.test(c.name) && /robotics/i.test(`${c.name} ${c.pitch} ${c.description}`));
      expect(new Set(both.map(c => c.id))).toEqual(new Set(expected.map(c => c.id)));
    }
  });

  test("recruitment counts add up, ids are unique, and sorting by name or deadline never drops a club", () => {
    const now = Date.now();
    const open = clubs600.filter(c => clubRecruitment(c, now).available).length;
    const closed = clubs600.filter(c => !clubRecruitment(c, now).available).length;
    expect(open + closed).toBe(600);
    expect(new Set(clubs600.map(c => c.id)).size).toBe(600);
    for (const sort of ["name", "deadline", "acceptance"]) expect(filterDirectory(clubs600, { ...emptyDirectoryFilters, sort }, now)).toHaveLength(600);
    expect(filterDirectory(clubs600, { ...emptyDirectoryFilters, recruitment: "open" }, now)).toHaveLength(open);
  });

  test("filtering 600 clubs with long descriptions stays fast (20 searches under a second)", () => {
    const started = Date.now();
    for (let i = 0; i < 20; i++) filterDirectory(clubs600, { ...emptyDirectoryFilters, query: `sing club ${i}` });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("a category with search, then Clear all, puts every club back", async () => {
    await renderRoute(route("(tabs)/explore"), { mode: "rich", overrides: { "explore.directory": { clubs: clubs600 } } });
    await fireEvent.changeText(screen.getByTestId("explore-search"), "rocketry");
    await wait(250);
    expect(screen.getByTestId("explore-count").props.children.join("")).toBe(`${filterDirectory(clubs600, { ...emptyDirectoryFilters, query: "rocketry" }).length} clubs`);
    await fireEvent.press(screen.getByTestId("explore-clear"));
    await wait(250);
    expect(screen.getByTestId("explore-count").props.children.join("")).toBe("600 clubs");
  });
});

describe("Saved clubs at scale and Save", () => {
  test("200 saved clubs: the count reads 200 and the list is virtualized", async () => {
    await renderRoute(route("saved-clubs"), { mode: "rich", overrides: { "clubs.saved": { items: clubs600.slice(0, 200).map(item => ({ club: item, savedAt: new Date().toISOString() })) } } });
    expect(screen.getByTestId("saved-count").props.children.join("")).toBe("200 saved clubs");
    expect(screen.queryAllByTestId(/^saved-club-\d+$/).length).toBeLessThan(30);
    expect(loggedCrashes()).toEqual([]);
  });

  test("a refused unsave puts Saved back and says why; a double tap sends one request", async () => {
    const { client } = await renderRoute(route("club/[id]"), { mode: "rich", params: { id: fullClub.id }, overrides: { "clubs.save": () => { throw new ApiError(403, "FORBIDDEN", "Alumni accounts can’t change saved clubs."); } } });
    expect(screen.getByText("Saved")).toBeTruthy();
    const follow = screen.getByTestId("club-follow");
    await fireEvent.press(follow);
    await fireEvent.press(follow);
    await settle(client);
    expect(apiState.calls.filter(call => call.operation === "clubs.save")).toHaveLength(1);
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText("Alumni accounts can’t change saved clubs.")).toBeTruthy();
  });

  test("saving from the club page shows on Saved clubs (shared cache, refetched from a server that remembers)", async () => {
    const target = club(9999);
    const server = new Map<string, PublicClub>([[fullClub.id, fullClub]]);
    const overrides = {
      club: { club: target },
      "clubs.saved": () => ({ items: [...server.values()].map(item => ({ club: item, savedAt: new Date().toISOString() })) }),
      "clubs.save": (input: unknown) => { const { clubId, saved } = input as { clubId: string; saved: boolean }; if (saved) server.set(clubId, target); else server.delete(clubId); return { saved, savedAt: null }; },
    };
    const { client } = await renderRoute(route("club/[id]"), { mode: "rich", params: { id: target.id }, overrides });
    await fireEvent.press(screen.getByTestId("club-follow"));
    await settle(client);
    expect(screen.getByText("Saved")).toBeTruthy();
    const saved = client.getQueryData<{ items: { club: PublicClub }[] }>(["clubs.saved", null]);
    expect(saved?.items.some(item => item.club.id === target.id)).toBe(true);
  });
});

describe("Club page: bad links and odd data", () => {
  test.each([[{}], [{ id: "" }], [{ id: ["a", "b"] as unknown as string }], [{ id: "   " }]])("params %j: 'no longer available', no request", async params => {
    await renderRoute(route("club/[id]"), { mode: "rich", params });
    expect(screen.getByText("This club is no longer available.")).toBeTruthy();
    expect(apiState.calls.some(call => call.operation === "club")).toBe(false);
  });

  test("a club with every optional field empty or null renders", async () => {
    const bare = { ...club(7), name: "x", pitch: "", description: "", category: "", marketing: null, rounds: [], requirements: [], publicEvents: [], applicationDeadline: null };
    await renderRoute(route("club/[id]"), { mode: "rich", params: { id: bare.id }, overrides: { club: { club: bare } } });
    expect(screen.getByTestId("club-name")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("Start application on an already-open draft opens it without asking the server", async () => {
    await renderRoute(route("club/[id]"), { mode: "rich", params: { id: ids.applyClub } });
    await fireEvent.press(screen.getByTestId("club-apply"));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/application/[id]", params: { id: ids.draftApplication } });
    expect(apiState.calls.some(call => call.operation === "applications.start")).toBe(false);
  });
});

describe("Events at scale, RSVP and dates", () => {
  const page = (input: unknown): EventBoard => {
    const n = (input as { page: number }).page;
    return { events: Array.from({ length: 60 }, (_, i) => campusEvent(10 + n * 60 + i, { id: uuid(20_000 + n * 60 + i) })), clubs: [], total: 300, hasMore: n < 4 };
  };

  test("300 events over 5 pages: each page loads once, keys stay unique, the count reads 300", async () => {
    const { client } = await renderRoute(route("events/index"), { mode: "rich", overrides: { "events.board": page } });
    expect(screenText(screen.toJSON())).toContain("300 events");
    for (let i = 0; i < 6; i++) {
      await act(async () => { fireEvent(screen.getByTestId("events-screen"), "onEndReached"); });
      await settle(client);
    }
    const pages = apiState.calls.filter(call => call.operation === "events.board").map(call => (call.input as { page: number }).page);
    expect(pages).toEqual([0, 1, 2, 3, 4]);
    expect((console.error as jest.Mock).mock.calls.filter(args => /same key/.test(args.join(" ")))).toEqual([]);
  });

  test("a refused RSVP is rolled back and explained; a double tap sends one request", async () => {
    const { client } = await renderRoute(route("events/[id]"), { mode: "rich", params: { id: ids.event }, overrides: { "events.rsvp": { going: false }, "events.rsvp.set": { ok: false, error: "This event is full." }, "events.event": { ...campusEvent(1), capacity: 500, rsvpDeadline: null } } });
    const rsvp = screen.getByTestId("event-rsvp");
    await fireEvent.press(rsvp);
    await fireEvent.press(rsvp);
    await settle(client);
    expect(apiState.calls.filter(call => call.operation === "events.rsvp.set")).toHaveLength(1);
    expect(screen.queryByTestId("event-going-status")).toBeNull();
    expect(screen.getByTestId("event-rsvp-error").props.children).toBe("This event is full.");
  });

  test.each([[{}], [{ id: "not-a-uuid" }], [{ id: [ids.event, ids.event2] as unknown as string }]])("event params %j: 'no longer available', no request", async params => {
    await renderRoute(route("events/[id]"), { mode: "rich", params });
    expect(screen.getByText("This event is no longer available.")).toBeTruthy();
    expect(apiState.calls.some(call => call.operation === "events.event")).toBe(false);
  });

  test("Eastern labels across midnight and the Nov 1 2026 clock change", () => {
    // 11 PM to 1 AM shows the second day.
    expect(eventScheduleLabel({ date: "2026-11-21T04:00:00Z", endDate: "2026-11-21T06:00:00Z", allDay: false })).toBe("Fri, Nov 20, 2026 · 11:00 PM – Sat, Nov 21, 2026 · 1:00 AM");
    // 1:30 AM EDT, then the repeated hour: 1:30 AM EST.
    expect(eventScheduleLabel({ date: "2026-11-01T05:30:00Z", endDate: "2026-11-01T06:30:00Z", allDay: false })).toBe("Sun, Nov 1, 2026 · 1:30 AM – 1:30 AM");
    // An all-day event stored as Eastern midnights with an exclusive end, across the change.
    expect(eventScheduleLabel({ date: "2026-10-31T04:00:00Z", endDate: "2026-11-02T05:00:00Z", allDay: true })).toBe("Sat, Oct 31, 2026 – Sun, Nov 1, 2026 · All day");
  });
});

describe("Home and My clubs at scale", () => {
  const memberships: Membership[] = Array.from({ length: 50 }, (_, i) => ({
    ...(records.memberMembership as Membership), id: uuid(30_000 + i), clubId: uuid(31_000 + i),
    club: { ...(records.memberMembership as Membership).club, id: uuid(31_000 + i), name: i % 3 ? `Club ${i} ${"🎻".repeat(i % 4)}` : `نادي ${i}`, logoUrl: null },
  }));
  const me = { ...(records.me as Me), memberships, adminRoles: [] };

  test("50 memberships and 200 tasks: Home renders and lists three tasks", async () => {
    const tasks = Array.from({ length: 200 }, (_, i) => ({ ...(homeView.tasks[1] as TaskNotification), id: `task-many-${i}`, title: `Task ${i}`, read: true, taskActivity: { assignmentId: uuid(40_000 + i), dueAt: null, needsSubmission: true } }));
    await renderRoute(route("(tabs)/index"), { mode: "rich", overrides: { me, "home.view": { ...homeView, tasks } } });
    expect(within(screen.getByTestId("home-tasks")).getAllByTestId(/^home-task-\d$/)).toHaveLength(3);
    expect(screen.getAllByTestId(/^home-club-/)).toHaveLength(50);
    expect(loggedCrashes()).toEqual([]);
  });

  test("My clubs with 50 memberships, and My club with a club the person isn't in", async () => {
    await renderRoute(route("my-clubs"), { mode: "rich", overrides: { me } });
    expect(screen.getAllByTestId(/^my-clubs-0000/)).toHaveLength(50);
    await renderRoute(route("my-club/[clubId]"), { mode: "rich", params: { clubId: uuid(99_999) } });
    expect(screen.getByText("You’re not a member of this club")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("Home in error mode shows the error, and a failed refresh keeps a loaded Home", async () => {
    await renderRoute(route("(tabs)/index"), { mode: "error" });
    expect(screenText(screen.toJSON())).toMatch(/test refusal/);
    const { client } = await renderRoute(route("(tabs)/index"), { mode: "rich" });
    apiState.overrides = { "home.view": busy };
    await act(async () => { await client.refetchQueries({ queryKey: ["home.view"] }).catch(() => {}); });
    await settle(client);
    expect(screen.getByTestId("home-hero")).toBeTruthy();
    expect(screen.getByTestId("stale-note")).toBeTruthy();
  });
});
