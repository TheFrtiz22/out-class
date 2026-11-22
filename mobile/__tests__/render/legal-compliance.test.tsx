/**
 * Legal and store compliance (Nov 22 sweep): a way to report club content (App Store 1.2), Terms,
 * Privacy and a contact inside the app (5.1.1), who sees an uploaded résumé or photo, and no
 * application answers left on the phone after sign-out.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, screen } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { SHEET_CLOSE_MS } from "~/components/sheet";
import { clearDeviceDrafts } from "~/lib/autosave";
import { apiState } from "./api-state";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";

const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const reports = () => apiState.calls.filter(call => call.operation === "reports.content");

beforeEach(captureConsole);
afterEach(releaseConsole);

async function sendReport(reason: string, details = "") {
  await fireEvent.press(screen.getByText(reason));
  if (details) await fireEvent.changeText(screen.getByTestId("report-details"), details);
  await fireEvent.press(screen.getByTestId("report-send"));
  await wait(0);
}

describe("reporting club content", () => {
  test("a club profile can be reported, and the server's thanks is shown", async () => {
    const Screen = require("~/app/club/[id]").default;
    await renderRoute(Screen, { params: { id: records.fullClub.id } });
    await fireEvent.press(screen.getByTestId("report-open"));
    expect(screen.getByTestId("report-send").props.accessibilityState?.disabled).toBe(true);
    await sendReport("Spam", "  Posts the same ad every day  ");
    expect(reports()).toEqual([expect.objectContaining({ method: "POST", input: { target: { type: "club", id: records.fullClub.id }, reason: "SPAM", details: "Posts the same ad every day" } })]);
    expect(screen.getByTestId("report-done")).toHaveTextContent("Thanks. Our team will review this.");
    expect(loggedCrashes()).toEqual([]);
  });

  test("members of the club don't see the report button on its own page", async () => {
    const Screen = require("~/app/club/[id]").default;
    await renderRoute(Screen, { params: { id: ids.memberClub }, overrides: { club: { club: { ...records.fullClub, id: ids.memberClub } } } });
    expect(screen.queryByTestId("report-open")).toBeNull();
  });

  test("a refusal the server returns as data is shown, not swallowed", async () => {
    const Screen = require("~/app/events/[id]").default;
    await renderRoute(Screen, { params: { id: ids.event }, overrides: { "reports.content": { ok: false, error: "You can’t report your own content." } } });
    await fireEvent.press(screen.getByTestId("report-open"));
    await sendReport("Impersonation");
    expect(reports()[0]?.input).toMatchObject({ target: { type: "event", id: ids.event }, reason: "IMPERSONATION" });
    expect(screen.getByTestId("report-error")).toHaveTextContent("You can’t report your own content.");
    expect(screen.queryByTestId("report-done")).toBeNull();
  });

  test("a copyright report offers the Terms' notice section", async () => {
    const Screen = require("~/app/events/[id]").default;
    await renderRoute(Screen, { params: { id: ids.event }, overrides: { "reports.content": { ok: true, message: "Thanks. Our team will review this.", dmcaHref: "/terms#legal-8-copyright-and-dmca-notices" } } });
    await fireEvent.press(screen.getByTestId("report-open"));
    await sendReport("Copyright infringement");
    await fireEvent.press(screen.getByTestId("report-dmca"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(expect.stringMatching(/\/terms#legal-8-copyright-and-dmca-notices$/));
  });

  test("a club announcement in the inbox can be reported once its detail closes", async () => {
    const announcement = "00000000-0000-4000-8000-000000000777";
    const row = { id: ids.inbox(1), clubId: ids.memberClub, type: "ANNOUNCEMENT", title: "Dues are due", body: "Pay by Friday.", href: null, readAt: null, archivedAt: null, createdAt: new Date().toISOString(), club: { name: "Virginia Motorsports", color: "#E57200", logoUrl: null }, eventKey: null, announcementId: announcement, ownAnnouncement: false };
    const Screen = require("~/app/inbox").default;
    await renderRoute(Screen, { overrides: { inbox: { items: [row], nextCursor: null, unread: 1 } } });
    await fireEvent.press(screen.getByText("Dues are due"));
    await fireEvent.press(screen.getByTestId("inbox-detail-report"));
    await wait(SHEET_CLOSE_MS + 120);
    await sendReport("Harassment or bullying");
    expect(reports()[0]?.input).toMatchObject({ target: { type: "announcement", id: announcement }, reason: "HARASSMENT" });
    expect(loggedCrashes()).toEqual([]);
  });

  test("an announcement the person wrote has no report action", async () => {
    const row = { id: ids.inbox(1), clubId: ids.leaderClub, type: "ANNOUNCEMENT", title: "My own news", body: "Hello.", href: null, readAt: null, archivedAt: null, createdAt: new Date().toISOString(), club: { name: "Club", color: "#E57200", logoUrl: null }, eventKey: null, announcementId: "00000000-0000-4000-8000-000000000778", ownAnnouncement: true };
    const Screen = require("~/app/inbox").default;
    await renderRoute(Screen, { overrides: { inbox: { items: [row], nextCursor: null, unread: 1 } } });
    await fireEvent.press(screen.getByText("My own news"));
    expect(screen.queryByTestId("inbox-detail-report")).toBeNull();
  });
});

describe("legal and support in Settings", () => {
  test("Terms and Privacy open on the website and Contact us starts an email", async () => {
    const Screen = require("~/app/settings/index").default;
    await renderRoute(Screen);
    await fireEvent.press(screen.getByTestId("settings-terms"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(expect.stringMatching(/\/terms$/));
    await fireEvent.press(screen.getByTestId("settings-privacy"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(expect.stringMatching(/\/privacy$/));
    await fireEvent.press(screen.getByTestId("settings-contact"));
    expect(Linking.openURL).toHaveBeenLastCalledWith("mailto:hello@out-class.net");
    expect(screen.getByTestId("settings-independence")).toHaveTextContent(/not an official service of the University of Virginia/);
  });
});

describe("uploads say who sees them", () => {
  test("the profile editor names who can see the photo and the résumé", async () => {
    const Screen = require("~/app/(tabs)/profile").default;
    const { client } = await renderRoute(Screen);
    await fireEvent.press(screen.getByTestId("profile-edit"));
    await settle(client);
    expect(screen.getByTestId("profile-photo-visibility")).toHaveTextContent("Clubs you apply to or join may see your photo.");
    await fireEvent.press(screen.getByText("Links & résumé"));
    await settle(client);
    expect(screen.getByTestId("profile-resume-visibility")).toHaveTextContent(/Clubs you apply to can see your résumé/);
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("sign-out leaves no application answers on the phone", () => {
  test("every saved draft copy is removed and other app data stays", async () => {
    await AsyncStorage.multiSet([["outclass:draft:v1:user-a:application:1", "{}"], ["outclass:draft:v1:user-b:availability", "{}"], ["outclass:appearance", "dark"]]);
    await clearDeviceDrafts();
    expect(await AsyncStorage.getAllKeys()).toEqual(["outclass:appearance"]);
  });
});
