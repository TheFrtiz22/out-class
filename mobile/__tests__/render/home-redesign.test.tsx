/**
 * Nov 22 Home redesign (the owner's two mockups): the website's time-of-day greeting, a hero card only
 * when something is pressing, sections that reorder by what needs the person (lib/home-priority.ts),
 * the Leading block for club leaders, and every row opening the right screen.
 */
import { fireEvent, screen, within } from "@testing-library/react-native";
import { votingStatus } from "~/components/home/home-sections";
import { headerGreeting, welcomeGreeting } from "~/lib/greeting";
import { BASE_ORDER, DAY, HOUR, type HomeInput, homeLayout, pickHero, rankApplications, upcoming } from "~/lib/home-priority";
import type { CalendarEvent, HomeApplication, HomeView, Me, Membership, StudentApplication, TaskNotification } from "~/lib/types";
import { ids, longName, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, screenText } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const NOW = new Date("2026-11-22T17:00:00Z"); // noon Eastern, a Sunday
const iso = (ms: number) => new Date(+NOW + ms).toISOString();
const event = (id: string, inMs: number, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, clubId: ids.memberClub, startTime: iso(inMs), endTime: iso(inMs + HOUR), date: "", day: 1, time: "", title: `Event ${id}`, club: "Club", color: "#000000", type: "Other", ...extra,
});
const task = (id: string, dueIn: number | null, extra: Partial<TaskNotification> = {}): TaskNotification => ({
  id, clubId: ids.memberClub, club: "Club", color: "#000000", title: `Task ${id}`, preview: "", urgent: false, read: true,
  taskActivity: { assignmentId: id, dueAt: dueIn === null ? null : iso(dueIn), needsSubmission: true }, ...extra,
});
const draft = (id: string, dueIn: number | null, extra: Partial<HomeApplication> = {}): HomeApplication => ({
  id, clubId: ids.applyClub, name: `Club ${id}`, color: "#000000", status: "DRAFTING", statusCode: "drafting", statusLabel: "Draft", draft: true, closed: false, intakeClosed: false,
  ...(dueIn === null ? {} : { deadline: event(`deadline-${id}`, dueIn, { type: "Deadline" }) }), ...extra,
});
const submitted = (id: string): HomeApplication => ({ ...draft(id, null), status: "SUBMITTED", statusCode: "submitted", statusLabel: "Submitted", draft: false });
const input = (extra: Partial<HomeInput> = {}): HomeInput => ({ now: NOW, applications: [], agenda: [], tasks: [], ...extra });
const vote = { clubId: ids.leaderClub, clubName: "Leader club", pendingReviews: 0, nextInterviewAt: null, liveVote: { sessionId: "s1", roundName: "Round 1" } };

describe("the greeting, as the website words it", () => {
  const at = (hour: number, minute = 0) => new Date(2026, 10, 22, hour, minute);
  test.each([
    [4, 59, "Still up, Jesse?"], [5, 0, "Good morning, Jesse."], [11, 59, "Good morning, Jesse."], [12, 0, "Good afternoon, Jesse."],
    [16, 59, "Good afternoon, Jesse."], [17, 0, "Good evening, Jesse."], [20, 59, "Good evening, Jesse."], [21, 0, "Still up, Jesse?"], [0, 30, "Still up, Jesse?"],
  ])("%i:%i reads %s", (hour, minute, words) => {
    expect(welcomeGreeting(at(hour, minute), "Jesse")).toBe(words);
  });
  test("the bar drops the full stop but keeps a question mark", () => {
    expect(headerGreeting(at(8), "Jesse")).toBe("Good morning, Jesse");
    expect(headerGreeting(at(23), "Jesse")).toBe("Still up, Jesse?");
  });
  test("no name, a blank name, or no clock", () => {
    expect(headerGreeting(at(14), null)).toBe("Good afternoon");
    expect(headerGreeting(at(14), "  ")).toBe("Good afternoon");
    expect(headerGreeting(new Date(NaN), "Jesse")).toBe("Welcome, Jesse");
    expect(welcomeGreeting(null)).toBe("Welcome to OutClass.");
  });
});

describe("what goes in the hero card", () => {
  test("nothing pressing: no hero", () => {
    expect(pickHero(input({ applications: [draft("a", 20 * DAY), submitted("b")], agenda: [event("e", 2 * DAY)], tasks: [task("t", 5 * DAY), task("u", null)] }))).toBeNull();
  });
  test("tier order: event soon, live vote, task due in a day, draft due in a week, task due in 3 days, draft due in 2 weeks", () => {
    const all = input({ agenda: [event("e", 2 * HOUR)], leading: [vote], tasks: [task("t1", 20 * HOUR), task("t3", 2.5 * DAY)], applications: [draft("a7", 6 * DAY), draft("a14", 12 * DAY)] });
    const order: string[] = [];
    let rest = all;
    for (let hero = pickHero(rest); hero; hero = pickHero(rest)) {
      order.push(hero.id);
      rest = {
        ...rest,
        agenda: rest.agenda.filter(item => `event:${item.id}` !== hero!.id),
        leading: hero.kind === "vote" ? [] : rest.leading,
        tasks: rest.tasks.filter(item => `task:${item.id}` !== hero!.id),
        applications: rest.applications.filter(item => `application:${item.id}` !== hero!.id),
      };
    }
    expect(order).toEqual(["event:e", "vote:s1", "task:t1", "application:a7", "task:t3", "application:a14"]);
  });
  test("an overdue task is pressing", () => {
    expect(pickHero(input({ tasks: [task("late", -2 * HOUR)] }))).toEqual(expect.objectContaining({ kind: "task", overdue: true }));
  });
  test("within a tier, the soonest wins", () => {
    expect(pickHero(input({ applications: [draft("later", 5 * DAY), draft("sooner", 2 * DAY)] }))?.id).toBe("application:sooner");
  });
  test("an event under way still counts until it ends; one that ended doesn't", () => {
    expect(pickHero(input({ agenda: [event("now", -30 * 60_000)] }))?.id).toBe("event:now");
    expect(pickHero(input({ agenda: [event("over", -2 * HOUR)] }))).toBeNull();
  });
  test("deadline rows, all-day events and declined events are never the hero", () => {
    expect(pickHero(input({ agenda: [event("d", HOUR, { type: "Deadline" }), event("all", HOUR, { allDay: true }), event("no", HOUR, { response: "DECLINED" })] }))).toBeNull();
  });
  test("drafts that can't be sent or whose deadline passed are not the hero", () => {
    expect(pickHero(input({ applications: [draft("closed", 2 * DAY, { intakeClosed: true }), draft("gone", 2 * DAY, { closed: true }), draft("passed", -HOUR), submitted("sent")] }))).toBeNull();
  });
  test("a draft with no deadline event uses the club's own deadline from Applications", () => {
    const detail = { ...(records.applicationsView.applications[0] as StudentApplication), id: "x", club: { ...(records.applicationsView.applications[0] as StudentApplication).club, applicationDeadline: iso(3 * DAY) } };
    expect(pickHero(input({ applications: [draft("x", null)], details: [detail] }))?.id).toBe("application:x");
  });
  test("a task already submitted (needsSubmission false) is not pressing", () => {
    expect(pickHero(input({ tasks: [task("done", HOUR, { taskActivity: { assignmentId: "done", dueAt: iso(HOUR), needsSubmission: false } })] }))).toBeNull();
  });
});

describe("the order of Home's sections", () => {
  test("calm day: My Clubs, Coming Up, Applications, then Leading and Tasks", () => {
    const layout = homeLayout(input({ leads: true, applications: [submitted("a")], agenda: [event("e", 3 * DAY)], tasks: [task("t", 9 * DAY)] }));
    expect(layout.hero).toBeNull();
    expect(layout.sections).toEqual(["myClubs", "comingUp", "applications", "leading", "tasks"]);
  });
  test("empty sections hide; My Clubs always stays so Find clubs is reachable", () => {
    expect(homeLayout(input()).sections).toEqual(["myClubs"]);
  });
  test("a leader with applicants to review gets Leading on top", () => {
    const layout = homeLayout(input({ leads: true, leading: [{ ...vote, liveVote: null, pendingReviews: 12 }], agenda: [event("e", 3 * DAY)] }));
    expect(layout.sections[0]).toBe("leading");
  });
  test("an interview the leader runs today lifts Leading; one later this week doesn't", () => {
    const today = homeLayout(input({ leads: true, leading: [{ ...vote, liveVote: null, nextInterviewAt: iso(4 * HOUR) }] }));
    const later = homeLayout(input({ leads: true, leading: [{ ...vote, liveVote: null, nextInterviewAt: iso(3 * DAY) }] }));
    expect(today.sections[0]).toBe("leading");
    expect(later.sections[0]).toBe("myClubs");
  });
  test("something today lifts Coming Up above My Clubs", () => {
    expect(homeLayout(input({ agenda: [event("e", 5 * HOUR)] })).sections).toEqual(["comingUp", "myClubs"]);
  });
  test("a new task or one due within two days lifts Tasks", () => {
    expect(homeLayout(input({ tasks: [task("t", 9 * DAY, { read: false })] })).sections[0]).toBe("tasks");
    // The soonest one is in the hero; a second one due within two days still lifts the list.
    expect(homeLayout(input({ tasks: [task("t", 30 * HOUR), task("u", 40 * HOUR)] })).sections[0]).toBe("tasks");
  });
  test("an application waiting on the person lifts Applications", () => {
    const detail = { ...(records.applicationsView.applications[0] as StudentApplication), id: "a", attention: true, decision: true };
    expect(homeLayout(input({ applications: [submitted("a")], details: [detail] })).sections[0]).toBe("applications");
  });
  test("what's in the hero doesn't push its own section up too", () => {
    const layout = homeLayout(input({ applications: [draft("a", 3 * DAY)] }));
    expect(layout.hero?.id).toBe("application:a");
    expect(layout.urgent.applications).toBe(false);
    expect(layout.sections).toEqual(["myClubs", "applications"]);
  });
  test("the mockup's day: a draft due soon in the hero, Leading next, then My Clubs", () => {
    const layout = homeLayout(input({ leads: true, leading: [{ ...vote, liveVote: null, pendingReviews: 12 }], applications: [draft("mii", 5 * DAY)] }));
    expect(layout.hero?.kind).toBe("application");
    expect(layout.sections.slice(0, 2)).toEqual(["leading", "myClubs"]);
  });
  test("ties keep the calm order", () => {
    expect(BASE_ORDER).toEqual(["myClubs", "comingUp", "applications", "leading", "tasks"]);
  });
});

describe("list order inside sections", () => {
  test("applications: waiting on you, then drafts due this week, then other drafts, then the rest", () => {
    const view = records.applicationsView.applications as StudentApplication[];
    const detail = (id: string, attention: boolean) => ({ ...view[0]!, id, attention });
    const ranked = rankApplications({ now: NOW, applications: [submitted("plain"), draft("later", 20 * DAY), draft("soon", 2 * DAY), submitted("decision")], details: [detail("plain", false), detail("decision", true)] });
    expect(ranked.map(item => item.id)).toEqual(["decision", "soon", "later", "plain"]);
  });
  test("Coming Up leaves out what's over and sorts by start", () => {
    expect(upcoming([event("b", 2 * DAY), event("past", -3 * HOUR), event("a", DAY)], NOW).map(item => item.id)).toEqual(["a", "b"]);
  });
  test("voting status picks the state that matters most", () => {
    expect(votingStatus([{ id: "1", state: "COMPLETED", joinOpenedAt: null, round: null }, { id: "2", state: "OPEN", joinOpenedAt: null, round: { name: "Round 1" } }])).toEqual(expect.objectContaining({ live: true, sessionId: "2", text: "Round 1: voting is open now" }));
    expect(votingStatus([{ id: "1", state: "DRAFT", joinOpenedAt: iso(0), round: null }]).text).toBe("Waiting room is open");
    expect(votingStatus([]).text).toBe("No voting session open");
    expect(votingStatus(undefined).live).toBe(false);
  });
});

const Home = () => require("~/app/(tabs)/index").default;

describe("Home on screen", () => {
  test("the rich account: a task due within a day beats a draft due this week for the hero; every section shows", async () => {
    await renderRoute(Home(), { mode: "rich" });
    const text = screenText(screen.toJSON());
    expect(within(screen.getByTestId("home-hero")).getByText("Open task")).toBeTruthy();
    expect(text.indexOf("Open task")).toBeLessThan(text.indexOf("My Clubs"));
    for (const title of ["Leading", "My Clubs", "Coming Up", "Applications", "Tasks"]) expect(text).toContain(title);
    expect(screen.queryByText("Next up")).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("with no task due, the draft due this week is the hero; progress shows its sections and Continue opens it", async () => {
    await renderRoute(Home(), { mode: "rich", overrides: { "home.view": { ...(records.homeView as HomeView), tasks: [] } } });
    expect(within(screen.getByTestId("home-hero")).getByText(`Finish your ${longName} application`)).toBeTruthy();
    expect(within(screen.getByTestId("home-hero")).getByText("2 of 3 sections left")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("home-hero-primary"));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/application/[id]", params: { id: ids.draftApplication } });
    await fireEvent.press(screen.getByTestId("home-hero-secondary"));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/club/[id]", params: { id: ids.applyClub } });
  });

  test("Leading shows the club's real counts and opens each tool", async () => {
    await renderRoute(Home(), { mode: "rich" });
    const leading = screen.getByTestId("home-leading");
    expect(within(leading).getByText("70 to review")).toBeTruthy();
    expect(within(leading).getByText(/^Maximiliana-Alexandria, C and \d+ others$/)).toBeTruthy();
    expect(within(leading).getByText(/Last sent .* · 42 people/)).toBeTruthy();
    for (const [key, path] of [["applicants", "/leader/[clubId]/applicants"], ["interviews", "/leader/[clubId]/interviews"], ["voting", "/leader/[clubId]/voting"], ["announce", "/leader/[clubId]/announce"]] as const) {
      routerState.router.push.mockClear();
      await fireEvent.press(screen.getByTestId(`home-leading-${key}`));
      expect(routerState.router.push).toHaveBeenCalledWith({ pathname: path, params: { clubId: ids.leaderClub } });
    }
    await fireEvent.press(screen.getByTestId(`home-leading-club-${ids.leaderClub}`));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/leader/[clubId]", params: { clubId: ids.leaderClub } });
  });

  test("leading sits above My Clubs when applicants wait for review", async () => {
    await renderRoute(Home(), { mode: "rich" });
    const order = screen.getAllByTestId(/^home-section-/).map(node => node.props.testID);
    expect(order.indexOf("home-section-leading")).toBeLessThan(order.indexOf("home-section-myClubs"));
  });

  test("someone who leads no club has no Leading section and fetches no leader data", async () => {
    const me = records.me as Me;
    const { } = await renderRoute(Home(), { mode: "rich", overrides: { me: { ...me, memberships: [records.memberMembership, records.alumniMembership] } } });
    expect(screen.queryByTestId("home-leading")).toBeNull();
  });

  test("a calm day shows no hero and starts with My Clubs", async () => {
    const home = records.homeView as HomeView;
    const calm: HomeView = { ...home, applications: home.applications.filter(item => !item.draft), agenda: home.agenda.filter(item => +new Date(item.startTime) > Date.now() + 2 * DAY), tasks: [] };
    const me = records.me as Me;
    await renderRoute(Home(), { mode: "rich", overrides: { "home.view": calm, "applications.view": { ...records.applicationsView, applications: records.applicationsView.applications.map(item => ({ ...item, attention: false })) }, me: { ...me, memberships: [records.memberMembership] } } });
    expect(screen.queryByTestId("home-hero")).toBeNull();
    expect(screen.getAllByTestId(/^home-section-/)[0]!.props.testID).toBe("home-section-myClubs");
  });

  test("My Clubs cards open the club, See all opens the list, Find clubs opens Explore", async () => {
    await renderRoute(Home(), { mode: "rich" });
    await fireEvent.press(screen.getByTestId(`home-club-${ids.memberClub}`));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/my-club/[clubId]", params: { clubId: ids.memberClub } });
    await fireEvent.press(screen.getByTestId("home-clubs-all"));
    expect(routerState.router.push).toHaveBeenCalledWith("/my-clubs");
    await fireEvent.press(screen.getByTestId("home-find-clubs"));
    // Explore is a tab: it switches to it rather than stacking a second set of tabs.
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/explore");
  });

  test("Coming Up's Calendar link switches tabs, and a meeting row opens the meeting", async () => {
    await renderRoute(Home(), { mode: "rich" });
    await fireEvent.press(screen.getByTestId("home-calendar"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/calendar");
    await fireEvent.press(screen.getByTestId("home-event-0"));
    expect(routerState.router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/meeting/[id]" }));
  });

  test("an application row shows its progress and opens it", async () => {
    await renderRoute(Home(), { mode: "rich" });
    const rows = screen.getAllByTestId(/^home-application-\d+$/);
    const row = rows.find(node => within(node).queryByText(/^Draft · \d+ of \d+ sections · due /))!;
    expect(row).toBeTruthy();
    await fireEvent.press(row);
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/application/[id]", params: { id: expect.any(String) } });
    await fireEvent.press(screen.getByTestId("home-applications-all"));
    expect(routerState.router.push).toHaveBeenCalledWith("/applications");
  });

  test("a new account: greeting, Find clubs, nothing else to scroll past", async () => {
    await renderRoute(Home(), { mode: "empty" });
    expect(screen.getByTestId("home-find-clubs")).toBeTruthy();
    expect(screen.queryByTestId("home-hero")).toBeNull();
    expect(screen.getAllByTestId(/^home-section-/).map(node => node.props.testID)).toEqual(["home-section-myClubs"]);
    expect(loggedCrashes()).toEqual([]);
  });

  test("a live voting room in a led club becomes the hero", async () => {
    await renderRoute(Home(), { mode: "rich", overrides: {
      "leader.overview": { operations: { rounds: [], bookings: [], votes: [{ id: ids.session, state: "OPEN", joinOpenedAt: new Date().toISOString(), round: { name: "Final round" } }] } },
      "home.view": { ...(records.homeView as HomeView), agenda: [] },
    } });
    expect(within(screen.getByTestId("home-hero")).getByText("Voting is open: Final round")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("home-hero-primary"));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/leader/[clubId]/voting", params: { clubId: ids.leaderClub } });
  });

  test("leader data that fails to load leaves Home working", async () => {
    await renderRoute(Home(), { mode: "rich", overrides: {
      "leader.overview": () => { throw new Error("refused"); },
      "leader.pipelinePage": () => { throw new Error("refused"); },
      "leader.announcements": () => { throw new Error("refused"); },
    } });
    expect(screen.getByTestId("home-leading")).toBeTruthy();
    expect(screen.getByText("No voting session open")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("membership types still accept a club without a banner", () => {
    const membership: Membership = records.memberMembership as Membership;
    expect(membership.club.bannerUrl ?? null).toBeNull();
  });
});
