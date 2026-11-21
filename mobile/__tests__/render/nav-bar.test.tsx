/** The bigger dock, its Apply / My Clubs middle tab, and the Inbox bell in the header (Nov 21 fixes). */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { DOCK_CLEARANCE } from "~/components/ui";
import { DOCK_ICON, DOCK_PADDING, DOCK_TAB_HEIGHT } from "~/lib/dock";
import { openRoute } from "~/lib/links";
import { applicationSettled, middleTabFor } from "~/lib/middle-tab";
import type { ApplicationsView, HomeView, Me, StudentApplication } from "~/lib/types";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(async () => { await AsyncStorage.clear(); releaseConsole(); });

const view = records.applicationsView as ApplicationsView;
const me = records.me as Me;
const homeView = records.homeView as HomeView;
const base = view.applications[0];
const app = (status: string, extra: Partial<StudentApplication> = {}): StudentApplication => ({
  ...base, id: `${status}-${Math.random()}`, status, statusCode: status, decision: ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(status), offerStatus: null, recruitmentOffer: null, intakeClosed: false, ...extra,
});
const settledView = (applications: StudentApplication[], alumni = false) => ({ ...view, alumni, applications });

describe("when an application is settled", () => {
  test.each([
    ["a draft that can still be sent", app("DRAFTING"), false],
    ["a draft whose club closed applications", app("DRAFTING", { intakeClosed: true }), true],
    ["submitted", app("SUBMITTED"), false],
    ["in review", app("IN_REVIEW"), false],
    ["interviewing", app("INTERVIEWING"), false],
    ["accepted, offer still to answer", app("ACCEPTED", { offerStatus: "PENDING" }), false],
    ["accepted, offer accepted", app("ACCEPTED", { offerStatus: "ACCEPTED" }), true],
    ["accepted, offer expired", app("ACCEPTED", { offerStatus: "EXPIRED" }), true],
    ["accepted with no offer", app("ACCEPTED"), true],
    ["rejected", app("REJECTED"), true],
    ["waitlisted", app("WAITLISTED"), true],
  ])("%s", (_name, application, settled) => {
    expect(applicationSettled(application)).toBe(settled);
  });

  test("an alumni account's draft can't be sent, so it is settled", () => {
    expect(applicationSettled(app("DRAFTING"), true)).toBe(true);
  });
  test("a lower-case status from an older server reads the same", () => {
    expect(applicationSettled(app("drafting"))).toBe(false);
  });
});

describe("which middle tab shows", () => {
  test("Apply while any application is still open", () => {
    expect(middleTabFor(settledView([app("ACCEPTED", { offerStatus: "ACCEPTED" }), app("SUBMITTED")]), 2)).toBe("apply");
    expect(middleTabFor(settledView([app("ACCEPTED", { offerStatus: "PENDING" })]), 2)).toBe("apply");
  });
  test("My Clubs once every application is settled and they are in a club", () => {
    expect(middleTabFor(settledView([app("ACCEPTED", { offerStatus: "ACCEPTED" }), app("REJECTED"), app("WAITLISTED")]), 1)).toBe("clubs");
    expect(middleTabFor(settledView([app("DRAFTING", { intakeClosed: true }), app("ACCEPTED", { offerStatus: "ACCEPTED" })]), 1)).toBe("clubs");
  });
  test("a member who never applied through OutClass sees My Clubs", () => {
    expect(middleTabFor(settledView([]), 1)).toBe("clubs");
  });
  test("Apply when there is no club to show", () => {
    expect(middleTabFor(settledView([app("REJECTED")]), 0)).toBe("apply");
    expect(middleTabFor(settledView([]), 0)).toBe("apply");
  });
});

describe("the dock", () => {
  async function renderDock(applications?: StudentApplication[], memberships = me.memberships) {
    const Layout = require("~/app/(tabs)/_layout").default;
    const overrides = { ...(applications ? { "applications.view": settledView(applications) } : {}), me: { ...me, memberships } };
    return renderRoute(Layout, { mode: "rich", overrides });
  }

  test("has five tabs and no Inbox: Home, Explore, Apply, Calendar, Profile", async () => {
    await renderDock();
    const tabs = within(screen.getByTestId("tab-dock")).getAllByRole("tab");
    expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual(["Home", "Explore", "Apply", "Calendar", "Profile"]);
    expect(screen.queryByTestId("tab-inbox")).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("switches the middle tab to My Clubs once every application is settled", async () => {
    await renderDock([app("ACCEPTED", { offerStatus: "ACCEPTED" }), app("REJECTED")]);
    expect(screen.getByTestId("tab-clubs-clubs").props.accessibilityLabel).toBe("My Clubs");
    expect(screen.queryByTestId("tab-clubs-apply")).toBeNull();
    expect(await AsyncStorage.getItem("outclass.middle-tab")).toBe("clubs");
  });

  test("keeps Apply while an offer still waits for an answer", async () => {
    await renderDock([app("ACCEPTED", { offerStatus: "PENDING" }), app("REJECTED")]);
    expect(screen.getByTestId("tab-clubs-apply").props.accessibilityLabel).toBe("Apply");
  });

  test("the middle tab opens /clubs", async () => {
    await renderDock();
    await new Promise(resolve => setTimeout(resolve, 450));
    fireEvent.press(screen.getByTestId("tab-clubs-apply"));
    expect(routerState.router.navigate).toHaveBeenCalledWith("/clubs");
  });

  test("is bigger: tall tabs, large icons, nearly the phone's width", async () => {
    await renderDock();
    const tab = screen.getByTestId("tab-home");
    const style = [typeof tab.props.style === "function" ? tab.props.style({ pressed: false }) : tab.props.style].flat().reduce((all, part) => ({ ...all, ...part }), {});
    expect(style.minHeight).toBe(DOCK_TAB_HEIGHT);
    expect(DOCK_TAB_HEIGHT).toBeGreaterThanOrEqual(60);
    expect(DOCK_ICON).toBeGreaterThanOrEqual(26);
    // The content of every tab screen clears the whole dock.
    expect(DOCK_CLEARANCE).toBeGreaterThanOrEqual(DOCK_TAB_HEIGHT + DOCK_PADDING * 2 + 20);
  });
});

describe("the Inbox bell", () => {
  test.each(["(tabs)/index", "(tabs)/explore", "(tabs)/clubs", "(tabs)/calendar", "(tabs)/profile"])("sits next to the scanner on %s", async file => {
    const Screen = require(`~/app/${file}`).default;
    await renderRoute(Screen, { mode: "rich", overrides: { "home.view": { ...homeView, inboxUnread: 4 } } });
    const bell = screen.getByTestId("header-inbox");
    expect(bell.props.accessibilityLabel).toBe("Inbox, 4 unread");
    expect(screen.getByTestId("header-scan")).toBeTruthy();
    expect(within(screen.getByTestId("header-inbox-badge")).getByText("4")).toBeTruthy();
    await fireEvent.press(bell);
    expect(routerState.router.push).toHaveBeenCalledWith("/inbox");
    expect(loggedCrashes()).toEqual([]);
  });

  test("shows no badge when nothing is unread", async () => {
    const Screen = require("~/app/(tabs)/explore").default;
    await renderRoute(Screen, { mode: "rich", overrides: { "home.view": { ...homeView, unread: 0, inboxUnread: 0 } } });
    expect(screen.getByTestId("header-inbox").props.accessibilityLabel).toBe("Inbox");
    expect(screen.queryByTestId("header-inbox-badge")).toBeNull();
  });

  test("caps a big count at 99+", async () => {
    const Screen = require("~/app/(tabs)/explore").default;
    await renderRoute(Screen, { mode: "rich", overrides: { "home.view": { ...homeView, inboxUnread: 240 } } });
    expect(within(screen.getByTestId("header-inbox-badge")).getByText("99+")).toBeTruthy();
  });

  test("the Inbox is a page with Back, no bell and no scanner", async () => {
    const Screen = require("~/app/inbox").default;
    await renderRoute(Screen, { mode: "rich" });
    expect(screen.getByTestId("header-back")).toBeTruthy();
    expect(screen.queryByTestId("header-inbox")).toBeNull();
    expect(screen.queryByTestId("header-scan")).toBeNull();
    await fireEvent.press(screen.getByTestId("header-back"));
    expect(routerState.router.back).toHaveBeenCalledTimes(1);
  });

  test("a notification that opens the Inbox pushes it over the tabs", () => {
    const router = { push: jest.fn(), dismissTo: jest.fn() };
    openRoute(router, { pathname: "/inbox" });
    expect(router.push).toHaveBeenCalledWith({ pathname: "/inbox" });
    openRoute(router, { pathname: "/clubs" });
    expect(router.dismissTo).toHaveBeenCalledWith("/clubs");
  });
});

describe("the middle tab's screen", () => {
  test("Apply lists applications, with a way to the person's clubs", async () => {
    const Screen = require("~/app/(tabs)/clubs").default;
    await renderRoute(Screen, { mode: "rich" });
    expect(screen.getByTestId("applications-screen")).toBeTruthy();
    expect(screen.getByText("Apply")).toBeTruthy();
    expect(screen.queryByTestId("header-back")).toBeNull();
    await fireEvent.press(screen.getByTestId("apply-my-clubs"));
    expect(routerState.router.push).toHaveBeenCalledWith("/my-clubs");
  });

  test("Apply with no applications sends you to the Explore tab", async () => {
    const Screen = require("~/app/(tabs)/clubs").default;
    await renderRoute(Screen, { mode: "empty" });
    await fireEvent.press(screen.getByTestId("applications-explore"));
    expect(routerState.router.navigate).toHaveBeenCalledWith("/explore");
  });

  test("My Clubs lists the person's clubs and marks the ones they lead", async () => {
    const Screen = require("~/app/(tabs)/clubs").default;
    await renderRoute(Screen, { mode: "rich", overrides: { "applications.view": settledView([app("ACCEPTED", { offerStatus: "ACCEPTED" })]) } });
    expect(screen.getByTestId("my-clubs-screen")).toBeTruthy();
    expect(screen.getByText("My Clubs")).toBeTruthy();
    for (const membership of me.memberships) expect(screen.getByTestId(`my-clubs-${membership.clubId}`)).toBeTruthy();
    expect(screen.getAllByText("Leader").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId(`my-clubs-${ids.leaderClub}`));
    expect(routerState.router.push).toHaveBeenCalledWith({ pathname: "/my-club/[clubId]", params: { clubId: ids.leaderClub } });
    await fireEvent.press(screen.getByTestId("my-clubs-applications"));
    expect(routerState.router.push).toHaveBeenCalledWith("/applications");
    expect(loggedCrashes()).toEqual([]);
  });

  test("the Applications page opened from Home keeps its Back arrow", async () => {
    const Screen = require("~/app/applications").default;
    await renderRoute(Screen, { mode: "rich" });
    expect(screen.getByTestId("header-back")).toBeTruthy();
    expect(screen.queryByTestId("header-inbox")).toBeNull();
  });
});
