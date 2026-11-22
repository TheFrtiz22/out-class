/**
 * Legal and store compliance in the app: the Settings "Legal & support" card, the agreement line and
 * not-affiliated line on Sign in, the Terms and Privacy placeholder screens, and in-app reporting of
 * clubs, events and announcements (App Store 1.2) through the `content.report` operation.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { ApiError } from "~/lib/api";
import { apiState } from "./api-state";
import { records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { routerState } from "./router-state";

// Which status bar style Sign in asks for (the real one only talks to the native side).
jest.mock("expo-status-bar", () => ({ StatusBar: jest.fn(() => null) }));

beforeEach(captureConsole);
afterEach(releaseConsole);

const NOT_AFFILIATED = "OutClass is independent and not affiliated with or endorsed by the University of Virginia.";
const posts = (operation: string) => apiState.calls.filter(call => call.method === "POST" && call.operation === operation).map(call => call.input);
const refusal = new ApiError(422, "REPORT_REFUSED", "You’ve sent several reports recently. Try again later.");
const refuse = () => { throw refusal; };

describe("Settings: Legal & support", () => {
  const Screen = () => require("~/app/settings/index").default;

  test("shows the card, its three rows and the not-affiliated line", async () => {
    await renderRoute(Screen());
    expect(screen.getByTestId("settings-legal")).toBeTruthy();
    expect(screen.getByText("Legal & support")).toBeTruthy();
    for (const label of ["Terms of Service", "Privacy Policy", "Contact support"]) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText("hello@out-class.net")).toBeTruthy();
    expect(screen.getByTestId("settings-not-affiliated").props.children).toBe(NOT_AFFILIATED);
  });

  test("Terms and Privacy open the in-app screens; Contact support opens mail to hello@out-class.net", async () => {
    await renderRoute(Screen());
    await fireEvent.press(screen.getByTestId("settings-terms"));
    expect(routerState.router.push).toHaveBeenLastCalledWith("/legal/terms");
    await fireEvent.press(screen.getByTestId("settings-privacy"));
    expect(routerState.router.push).toHaveBeenLastCalledWith("/legal/privacy");
    await fireEvent.press(screen.getByTestId("settings-support"));
    expect(Linking.openURL).toHaveBeenLastCalledWith("mailto:hello@out-class.net");
    expect(loggedCrashes()).toEqual([]);
  });

  test("a phone with no mail app keeps the screen as it is", async () => {
    await renderRoute(Screen());
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error("No app handles mailto"));
    await fireEvent.press(screen.getByTestId("settings-support"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(screen.getByTestId("settings-legal")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("Sign in", () => {
  test("says what continuing agrees to, links both documents in the app, and says OutClass isn't UVA's", async () => {
    const SignIn = require("~/app/sign-in").default;
    await renderRoute(SignIn, { segments: ["sign-in"], pathname: "/sign-in" });
    expect(screen.getByText(/By continuing, you agree to our/)).toBeTruthy();
    expect(screen.getByTestId("sign-in-not-affiliated").props.children).toBe(NOT_AFFILIATED);
    await fireEvent.press(screen.getByTestId("sign-in-terms"));
    expect(routerState.router.push).toHaveBeenLastCalledWith("/legal/terms");
    await fireEvent.press(screen.getByTestId("sign-in-privacy"));
    expect(routerState.router.push).toHaveBeenLastCalledWith("/legal/privacy");
    expect(screen.getByTestId("sign-in-terms").props.accessibilityRole).toBe("link");
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("Terms and Privacy placeholders", () => {
  test.each([
    ["terms", "Terms of Service", "Our Terms of Service are being finalized", "The full Terms of Service will appear here before OutClass launches."],
    ["privacy", "Privacy Policy", "Our Privacy Policy is being finalized", "The full Privacy Policy will appear here before OutClass launches."],
  ])("%s says it is being finalized and how to reach support", async (file, title, heading, body) => {
    const Screen = require(`~/app/legal/${file}`).default;
    await renderRoute(Screen, { segments: ["legal", file], pathname: `/legal/${file}` });
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.getByText(heading)).toBeTruthy();
    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.getByText(/Questions in the meantime\? Email us at/)).toBeTruthy();
    expect(screen.getByText(NOT_AFFILIATED)).toBeTruthy();
    // No draft policy text: the placeholder never shows sections of the web draft.
    expect(screen.queryByText(/Information we collect|Acceptance of these Terms/i)).toBeNull();
    await fireEvent.press(screen.getByTestId(`legal-${file}-contact`));
    expect(Linking.openURL).toHaveBeenLastCalledWith("mailto:hello@out-class.net");
    // These screens call nothing: they work signed out.
    expect(apiState.calls).toEqual([]);
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("Report", () => {
  const otherClub = "00000000-0000-4000-8000-000000000777";

  async function report(testID: string, reason: string, client: Parameters<typeof settle>[0]) {
    await fireEvent.press(screen.getByTestId(testID));
    // Nothing is sent until a reason is chosen.
    expect(screen.getByTestId("report-submit").props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId(`report-reason-${reason.toLowerCase()}`));
    await fireEvent.press(screen.getByTestId("report-submit"));
    await settle(client);
  }

  test("a club page reports the club with the chosen reason and shows the confirmation", async () => {
    const Screen = require("~/app/club/[id]").default;
    const { client } = await renderRoute(Screen, { params: { id: records.fullClub.id } });
    await report("club-report", "HARASSMENT", client);
    expect(posts("content.report")).toEqual([{ target: { type: "club", id: records.fullClub.id }, reason: "HARASSMENT" }]);
    expect(screen.getByTestId("report-done")).toBeTruthy();
    expect(screen.getByText("Thanks. Our team will review this.")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("a club the account runs offers no Report", async () => {
    const Screen = require("~/app/club/[id]").default;
    await renderRoute(Screen, { params: { id: records.leaderMembership.clubId }, overrides: { club: { club: { ...records.fullClub, id: records.leaderMembership.clubId } } } });
    expect(screen.getAllByText(records.fullClub.name, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("club-report")).toBeNull();
  });

  test("an event page reports the event, and its flyer separately", async () => {
    const Screen = require("~/app/events/[id]").default;
    const event = { ...records.campusEvent(1), clubId: otherClub, flyerUrl: "https://out-class.test/flyer.png" };
    const { client } = await renderRoute(Screen, { params: { id: event.id }, overrides: { "events.event": event } });
    await report("event-report", "SPAM", client);
    expect(posts("content.report")).toEqual([{ target: { type: "event", id: event.id }, reason: "SPAM" }]);
    expect(screen.getByText("Thanks. Our team will review this.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("report-close"));
    await settle(client);
    await report("event-report-flyer", "COPYRIGHT", client);
    expect(posts("content.report")[1]).toEqual({ target: { type: "event-flyer", eventId: event.id }, reason: "COPYRIGHT" });
    expect(loggedCrashes()).toEqual([]);
  });

  test("an event hosted by a club the account runs offers no Report", async () => {
    const Screen = require("~/app/events/[id]").default;
    const event = { ...records.campusEvent(1), clubId: records.leaderMembership.clubId };
    await renderRoute(Screen, { params: { id: event.id }, overrides: { "events.event": event } });
    expect(screen.getByTestId("event-title")).toBeTruthy();
    expect(screen.queryByTestId("event-report")).toBeNull();
  });

  test("an announcement in the Inbox is reported from its detail sheet", async () => {
    const Screen = require("~/app/inbox").default;
    const announcementId = "00000000-0000-4000-8000-000000000601";
    const row = { id: "00000000-0000-4000-8000-000000000a01", clubId: otherClub, type: "ANNOUNCEMENT", title: "Dues are due", body: "Pay by Friday.", href: null, readAt: null, archivedAt: null, createdAt: "2026-11-20T12:00:00.000Z", club: { name: "Some Club", color: "#E57200", logoUrl: null }, eventKey: null, announcementId, ownAnnouncement: false };
    const { client } = await renderRoute(Screen, { overrides: { inbox: { items: [row], nextCursor: null, unread: 1 } } });
    await fireEvent.press(screen.getByTestId("inbox-row-announcement"));
    await settle(client);
    await report("inbox-detail-report", "INAPPROPRIATE", client);
    expect(posts("content.report")).toEqual([{ target: { type: "announcement", id: announcementId }, reason: "INAPPROPRIATE" }]);
    expect(screen.getByText("Thanks. Our team will review this.")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("the author of an announcement isn't offered Report", async () => {
    const Screen = require("~/app/inbox").default;
    const row = { id: "00000000-0000-4000-8000-000000000a02", clubId: otherClub, type: "ANNOUNCEMENT", title: "Mine", body: "Body", href: null, readAt: null, archivedAt: null, createdAt: "2026-11-20T12:00:00.000Z", club: { name: "Some Club", color: "#E57200", logoUrl: null }, eventKey: null, announcementId: "00000000-0000-4000-8000-000000000602", ownAnnouncement: true };
    const { client } = await renderRoute(Screen, { overrides: { inbox: { items: [row], nextCursor: null, unread: 1 } } });
    await fireEvent.press(screen.getByTestId("inbox-row-announcement"));
    await settle(client);
    expect(screen.getByTestId("inbox-detail-read")).toBeTruthy();
    expect(screen.queryByTestId("inbox-detail-report")).toBeNull();
  });

  test("a refusal shows the server's reason, keeps the form, and a retry can still succeed", async () => {
    const Screen = require("~/app/club/[id]").default;
    const { client } = await renderRoute(Screen, { params: { id: records.fullClub.id }, overrides: { "content.report": refuse } });
    await report("club-report", "OTHER", client);
    expect(screen.getByTestId("report-error").props.children).toBe(refusal.message);
    expect(screen.queryByTestId("report-done")).toBeNull();
    expect(screen.getByTestId("report-form")).toBeTruthy();
    apiState.overrides = {};
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 460)); }); // past the button's double-tap guard
    await fireEvent.press(screen.getByTestId("report-submit"));
    await settle(client);
    expect(screen.getByTestId("report-done")).toBeTruthy();
    expect(posts("content.report")).toHaveLength(2);
    expect(loggedCrashes()).toEqual([]);
  });

  test("a failure with no server answer shows the general message, not a crash", async () => {
    const Screen = require("~/app/events/[id]").default;
    const event = { ...records.campusEvent(1), clubId: otherClub };
    const { client } = await renderRoute(Screen, { params: { id: event.id }, overrides: { "events.event": event, "content.report": () => { throw new Error("Network down"); } } });
    await report("event-report", "SPAM", client);
    expect(screen.getByTestId("report-error").props.children).toBe("We couldn’t send your report. Please try again.");
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("iOS privacy manifest", () => {
  type Entry = { NSPrivacyCollectedDataType: string; NSPrivacyCollectedDataTypeLinked: boolean; NSPrivacyCollectedDataTypeTracking: boolean; NSPrivacyCollectedDataTypePurposes: string[] };
  const manifest = () => {
    let build: (context: { config: object }) => { ios: { privacyManifests: { NSPrivacyTracking: boolean; NSPrivacyCollectedDataTypes: Entry[] } } } = () => { throw new Error("not loaded"); };
    jest.isolateModules(() => { build = require("../../app.config").default; });
    return build({ config: {} }).ios.privacyManifests;
  };

  test("declares what the app collects with Apple's keys: account data linked, crash and diagnostics not, nothing for tracking", () => {
    const { NSPrivacyTracking, NSPrivacyCollectedDataTypes: types } = manifest();
    expect(NSPrivacyTracking).toBe(false);
    const linked = Object.fromEntries(types.map(entry => [entry.NSPrivacyCollectedDataType, entry.NSPrivacyCollectedDataTypeLinked]));
    expect(linked).toEqual({
      NSPrivacyCollectedDataTypeName: true, NSPrivacyCollectedDataTypeEmailAddress: true, NSPrivacyCollectedDataTypePhoneNumber: true,
      NSPrivacyCollectedDataTypePhotosorVideos: true, NSPrivacyCollectedDataTypeOtherUserContent: true, NSPrivacyCollectedDataTypeUserID: true,
      NSPrivacyCollectedDataTypeCrashData: false, NSPrivacyCollectedDataTypeOtherDiagnosticData: false,
    });
    for (const entry of types) {
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypePurposes).toEqual(["NSPrivacyCollectedDataTypePurposeAppFunctionality"]);
    }
  });
});
