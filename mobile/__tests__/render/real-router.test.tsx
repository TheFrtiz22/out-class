/**
 * Opening links against the real expo-router (not the in-memory mock the other render tests use):
 * the root stack must never hold a second `(tabs)`, which showed as a second dock and a Back arrow on Home.
 * Covers a tapped push (Inbox, calendar links), Inbox rows, Home rows and the scanner.
 */
jest.unmock("expo-router");
import { act, renderRouter } from "expo-router/testing-library";
import { router } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { openRoute, routeForHref } from "~/lib/links";

type NavState = { index: number; routes: { name: string; params?: Record<string, unknown>; state?: NavState }[] };
const Page = (name: string) => () => React.createElement(Text, null, name);

async function app(initialUrl = "/") {
  const { Stack, Tabs } = jest.requireActual("expo-router");
  return renderRouter({
    _layout: () => React.createElement(Stack, null),
    "(tabs)/_layout": () => React.createElement(Tabs, null),
    "(tabs)/index": Page("home"),
    "(tabs)/calendar": Page("calendar"),
    "(tabs)/explore": Page("explore"),
    inbox: Page("inbox"),
    scan: Page("scan"),
    "meeting/[id]": Page("meeting"),
  }, { initialUrl });
}
/** The root stack's screens, by name. */
const stack = (state: unknown) => ((state as NavState).routes[0].state as NavState).routes.map(route => route.name);
const go = (route: Parameters<typeof openRoute>[1], mode?: Parameters<typeof openRoute>[2]) => act(async () => openRoute(router, route, mode));

const MEETINGS = routeForHref("/meetings")!; // the calendar, filtered to meetings

describe("no second set of tabs", () => {
  test("a push for the Inbox, then one for the calendar", async () => {
    const screen = await app();
    await go({ pathname: "/inbox" }, "reuse");
    expect(stack(screen.getRouterState())).toEqual(["(tabs)", "inbox"]);
    await go(MEETINGS, "reuse");
    expect(stack(screen.getRouterState())).toEqual(["(tabs)"]);
    expect(screen.getPathnameWithParams()).toBe("/calendar?type=meeting");
  });

  test("a second push for the Inbox while it is open leaves one Inbox", async () => {
    const screen = await app();
    await go({ pathname: "/inbox" }, "reuse");
    await go({ pathname: "/inbox" }, "reuse");
    expect(stack(screen.getRouterState())).toEqual(["(tabs)", "inbox"]);
  });

  test("an Inbox row that links to a tab goes back to the tabs", async () => {
    const screen = await app();
    await go({ pathname: "/inbox" });
    await go({ pathname: "/explore" });
    expect(stack(screen.getRouterState())).toEqual(["(tabs)"]);
    expect(screen.getPathname()).toBe("/explore");
  });

  test("a Home row that links to the calendar switches tabs", async () => {
    const screen = await app();
    await go(MEETINGS);
    expect(stack(screen.getRouterState())).toEqual(["(tabs)"]);
    expect(screen.getPathnameWithParams()).toBe("/calendar?type=meeting");
  });

  test("a scanned code that leads to a tab closes the scanner", async () => {
    const screen = await app();
    await act(async () => router.push("/scan"));
    await go({ pathname: "/explore" }, "replace");
    expect(stack(screen.getRouterState())).toEqual(["(tabs)"]);
    expect(screen.getPathname()).toBe("/explore");
  });

  test("a scanned code opened on a cold start puts the tabs in the scanner's place", async () => {
    const screen = await app("/scan");
    await go({ pathname: "/explore" }, "replace");
    expect(stack(screen.getRouterState())).toEqual(["(tabs)"]);
  });

  test("other screens still stack, so Back returns to where the person was", async () => {
    const screen = await app();
    await go({ pathname: "/inbox" });
    await go({ pathname: "/meeting/[id]", params: { id: "m1" } }, "reuse");
    await go({ pathname: "/meeting/[id]", params: { id: "m2" } }, "reuse");
    expect(stack(screen.getRouterState())).toEqual(["(tabs)", "inbox", "meeting/[id]", "meeting/[id]"]);
  });
});
