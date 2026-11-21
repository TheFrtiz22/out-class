/** The refresh spinner shows only while a person's own pull runs, never for a screen's background reloads. */
import { act, screen, waitFor } from "@testing-library/react-native";
import { api } from "~/lib/api";
import { ids } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";

// The tests' tsconfig has no Node types; these are the few file reads the source check needs.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require("fs") as { readdirSync(dir: string): string[]; readFileSync(path: string, encoding: "utf8"): string; statSync(path: string): { isDirectory(): boolean } };
const join = (...parts: string[]) => parts.join("/");

beforeEach(captureConsole);
afterEach(releaseConsole);

type Control = { refreshing: boolean; onRefresh: () => void };
/** Every pull-to-refresh control on screen (the scroll view's `refreshControl`). */
function pullControls(): Control[] {
  const found: Control[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const element = node as { props?: { refreshControl?: { props: Control } }; children?: unknown };
    if (element.props?.refreshControl) found.push(element.props.refreshControl.props);
    walk(element.children);
  };
  walk(screen.toJSON());
  return found;
}

/** Holds every API answer until `release` runs, so a reload stays in flight while the test looks. */
function holdApi() {
  // Swapped by hand: the module mock's `api.get` is already a jest.fn, and spying on it would change that mock itself.
  const target = api as { get: typeof api.get; post: typeof api.post };
  const { get, post } = target;
  let open!: () => void;
  const gate = new Promise<void>(resolve => { open = resolve; });
  target.get = ((operation: string, input?: unknown) => gate.then(() => get(operation, input))) as typeof api.get;
  target.post = ((operation: string, input?: unknown) => gate.then(() => post(operation, input))) as typeof api.post;
  return { release: () => { target.get = get; target.post = post; open(); } };
}

// Every row has two entries: Jest reads a test function with more parameters than the row as one awaiting `done`.
const screens: [string, Record<string, string>][] = [
  ["(tabs)/index", {}], ["(tabs)/explore", {}], ["inbox", {}], ["(tabs)/calendar", {}], ["(tabs)/profile", {}],
  ["applications", {}], ["saved-clubs", {}], ["tasks", {}], ["events/index", {}],
  ["club/[id]", { id: ids.applyClub }], ["events/[id]", { id: ids.event }],
];

describe("a background reload never shows the refresh spinner", () => {
  test.each(screens)("%s", async (file, params) => {
    const Screen = require(`~/app/${file}`).default;
    const { client } = await renderRoute(Screen, { mode: "rich", params });
    expect(pullControls().length).toBeGreaterThan(0);
    const hold = holdApi();
    // What opening the screen again, returning to the app or saving something does: the queries reload on their own.
    await act(async () => { void client.invalidateQueries(); });
    await waitFor(() => { expect(client.isFetching()).toBeGreaterThan(0); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    expect(pullControls().every(control => control.refreshing === false)).toBe(true);
    hold.release();
    await settle(client);
    expect(pullControls().every(control => control.refreshing === false)).toBe(true);
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("a pull shows the spinner until its reload finishes", () => {
  test.each([["(tabs)/explore"], ["(tabs)/index"], ["(tabs)/calendar"], ["applications"]])("%s", async file => {
    const Screen = require(`~/app/${file}`).default;
    const { client } = await renderRoute(Screen, { mode: "rich" });
    const hold = holdApi();
    await act(async () => { pullControls()[0].onRefresh(); });
    expect(pullControls()[0].refreshing).toBe(true);
    hold.release();
    await settle(client);
    await waitFor(() => { expect(pullControls()[0].refreshing).toBe(false); });
  });
});

describe("no screen draws its own refresh control", () => {
  const root = join(__dirname, "../../src");
  const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
  test("only the shared control (components/ui.tsx, lib/pull-refresh.ts) uses RefreshControl or sets `refreshing`", () => {
    const offenders = files(root).filter(path => !path.endsWith(join("components", "ui.tsx")) && !path.endsWith(join("lib", "pull-refresh.ts")))
      .filter(path => /\bRefreshControl\b|\brefreshing=\{/.test(readFileSync(path, "utf8")))
      .map(path => path.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });
});
