import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import type { ComponentType } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "~/lib/auth";
import { createQueryClient } from "~/lib/query";
import { ThemeProvider } from "~/lib/theme";
import { apiState, resetApi, type ApiMode } from "./api-state";
import type { FixtureSet } from "./fixtures";
import { resetRouter } from "./router-state";

/** An iPhone 15-sized window with a notch and a home indicator. */
const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };

export type RenderOptions = { mode?: ApiMode; params?: Record<string, string | string[] | undefined>; segments?: string[]; pathname?: string; overrides?: FixtureSet; providers?: boolean; strictInputs?: boolean };

/** Errors logged while rendering that mean a crash, not a warning. */
const crashPattern = /TypeError|ReferenceError|RangeError|is not a function|Cannot read propert|undefined is not|null is not|Invalid time value|Maximum update depth|Rendered (more|fewer) hooks/;

let logged: string[] = [];
let consoleError: jest.SpyInstance | undefined;

export function captureConsole() {
  logged = [];
  consoleError = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}\n${arg.stack}` : String(arg))).join(" "));
  });
  jest.spyOn(console, "warn").mockImplementation(() => {});
}

const clients: QueryClient[] = [];

export function releaseConsole() {
  // The query cache's garbage-collection timers would otherwise keep Jest alive.
  for (const client of clients.splice(0)) client.clear();
  consoleError?.mockRestore();
  jest.restoreAllMocks();
}

/** Crash-like errors React or the app logged during the test. */
export const loggedCrashes = () => logged.filter(line => crashPattern.test(line));

export function makeQueryClient(): QueryClient {
  const client = createQueryClient();
  clients.push(client);
  // Same client the app makes, but without the retry backoff so error states show at once.
  client.setDefaultOptions({ ...client.getDefaultOptions(), queries: { ...client.getDefaultOptions().queries, retry: false } });
  return client;
}

/** Renders a route's default export inside the app's real providers and waits for every query to settle. */
export async function renderRoute(Screen: ComponentType, options: RenderOptions = {}) {
  resetApi(options.mode ?? "rich", options.overrides, options.strictInputs);
  resetRouter(options.params, options.segments, options.pathname);
  const client = makeQueryClient();
  const tree = options.providers === false ? <Screen /> : (
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <AuthProvider>
            <Screen />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
  const result = await render(tree);
  await settle(client);
  return { ...result, client, screen };
}

export async function settle(client: QueryClient) {
  await waitFor(() => { expect(client.isFetching() + client.isMutating()).toBe(0); }, { timeout: 5000 });
  // Let effects that run after the data arrives (and their own promises) finish.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  await waitFor(() => { expect(client.isFetching() + client.isMutating()).toBe(0); }, { timeout: 5000 });
}

export function missingFixtures() {
  return [...apiState.missing];
}

type Node = { type?: string; children?: (Node | string)[] | null } | string | null;
/** The text a rendered tree shows, one Text element per line. */
export function screenText(tree: Node | Node[]): string {
  const lines: string[] = [];
  const inline = (node: Node | Node[]): string => !node ? "" : Array.isArray(node) ? node.map(inline).join("") : typeof node === "string" ? node : (node.children ?? []).map(inline).join("");
  const walk = (node: Node | Node[], into: string[]) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(child => walk(child, into)); return; }
    if (typeof node === "string") { into.push(node); return; }
    if (node.type === "Text") { lines.push(inline(node)); return; }
    (node.children ?? []).forEach(child => walk(child, into));
  };
  walk(tree, lines);
  return lines.filter(Boolean).join("\n");
}
