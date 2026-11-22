/**
 * The redesigned Home's links (Nov 22) on the real expo-router, not the in-memory mock. The real router's test
 * harness doesn't draw screen contents here (pages render empty), so this replays the exact routes Home's taps
 * send through openRoute, as home-redesign.test.tsx asserts them, and checks the root stack never holds a
 * second `(tabs)` (the PR 513 freeze came from a tap the mock didn't catch).
 */
jest.unmock("expo-router");
import { act, renderRouter } from "expo-router/testing-library";
import { router } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { openRoute, type AppRoute as Route } from "~/lib/links";

type NavState = { index: number; routes: { name: string; params?: Record<string, unknown>; state?: NavState }[] };
const Page = (name: string) => () => React.createElement(Text, null, name);
const CLUB = "00000000-0000-4000-8000-000000000002";
const APP = "00000000-0000-4000-8000-000000000010";

async function app() {
  const { Stack, Tabs } = jest.requireActual("expo-router");
  return renderRouter({
    _layout: () => React.createElement(Stack, null),
    "(tabs)/_layout": () => React.createElement(Tabs, null),
    "(tabs)/index": Page("home"),
    "(tabs)/calendar": Page("calendar"),
    "(tabs)/explore": Page("explore"),
    "(tabs)/profile": Page("profile"),
    "application/[id]": Page("application"),
    "club/[id]": Page("club"),
    "my-club/[clubId]": Page("my-club"),
    "my-clubs": Page("my-clubs"),
    applications: Page("applications"),
    tasks: Page("tasks"),
    "meeting/[id]": Page("meeting"),
    "leader/[clubId]/index": Page("leader"),
    "leader/[clubId]/applicants": Page("applicants"),
    "leader/[clubId]/interviews": Page("interviews"),
    "leader/[clubId]/voting": Page("voting"),
    "leader/[clubId]/announce": Page("announce"),
  }, { initialUrl: "/" });
}
const stack = (state: unknown) => ((state as NavState).routes[0].state as NavState).routes.map(route => route.name);
const go = (route: Route) => act(async () => openRoute(router, route));

describe("Home's taps on the real router", () => {
  test.each<[string, Route, string]>([
    ["Coming Up's Calendar link", { pathname: "/calendar" }, "/calendar"],
    ["the Find clubs card", { pathname: "/explore" }, "/explore"],
  ])("%s switches tabs without a second set of tabs", async (_name, route, path) => {
    const screen = await app();
    await go(route);
    expect(stack(screen.getRouterState())).toEqual(["(tabs)"]);
    expect(screen.getPathname()).toBe(path);
  });

  test.each<[string, Route, string]>([
    ["the hero's Continue", { pathname: "/application/[id]", params: { id: APP } }, "application/[id]"],
    ["the hero's View club", { pathname: "/club/[id]", params: { id: CLUB } }, "club/[id]"],
    ["a My Clubs card", { pathname: "/my-club/[clubId]", params: { clubId: CLUB } }, "my-club/[clubId]"],
    ["See all clubs", { pathname: "/my-clubs" }, "my-clubs"],
    ["an application row", { pathname: "/application/[id]", params: { id: APP } }, "application/[id]"],
    ["View all applications", { pathname: "/applications" }, "applications"],
    ["All tasks", { pathname: "/tasks" }, "tasks"],
    ["a Leading club name", { pathname: "/leader/[clubId]", params: { clubId: CLUB } }, "leader/[clubId]/index"],
    ["Leading's Applicants row", { pathname: "/leader/[clubId]/applicants", params: { clubId: CLUB } }, "leader/[clubId]/applicants"],
    ["Leading's Interviews row", { pathname: "/leader/[clubId]/interviews", params: { clubId: CLUB } }, "leader/[clubId]/interviews"],
    ["Leading's Voting row", { pathname: "/leader/[clubId]/voting", params: { clubId: CLUB } }, "leader/[clubId]/voting"],
    ["Leading's Announcements row", { pathname: "/leader/[clubId]/announce", params: { clubId: CLUB } }, "leader/[clubId]/announce"],
  ])("%s opens one screen over the tabs", async (_name, route, name) => {
    const screen = await app();
    await go(route);
    expect(stack(screen.getRouterState())).toEqual(["(tabs)", name]);
  });

  test("after a pushed screen, a tab link from Home's hero (Calendar) goes back to one set of tabs", async () => {
    const screen = await app();
    await go({ pathname: "/application/[id]", params: { id: APP } });
    await go({ pathname: "/calendar" });
    expect(stack(screen.getRouterState())).toEqual(["(tabs)"]);
    expect(screen.getPathname()).toBe("/calendar");
  });
});
