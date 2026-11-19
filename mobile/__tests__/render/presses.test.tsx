/**
 * Presses every button, link, tab and switch each route shows with rich data, one after another,
 * and fails on a handler that throws, a crash React logged, or a rejection nobody handled.
 * Navigation is the in-memory router, so presses stay on the screen under test.
 */
import { fireEvent } from "@testing-library/react-native";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { apiState } from "./api-state";
import { routerState } from "./router-state";
import { routes } from "./routes";

const unhandled: string[] = [];
const onRejection = (reason: unknown) => { unhandled.push(reason instanceof Error ? `${reason.name}: ${reason.message}\n${reason.stack}` : String(reason)); };
beforeAll(() => { process.on("unhandledRejection", onRejection); });
afterAll(() => { process.off("unhandledRejection", onRejection); });
beforeEach(() => { unhandled.length = 0; captureConsole(); });
afterEach(releaseConsole);

const roles = ["button", "link", "tab", "switch", "checkbox", "radio", "menuitem"] as const;
type Element = { props: Record<string, unknown> };
const label = (element: Element) => String(element.props.accessibilityLabel ?? element.props.testID ?? element.props["aria-label"] ?? "(unlabelled)");

describe.each(routes.filter(route => !route.ownProviders && !route.failing?.rich))("$file", route => {
  const known = route.failing?.presses;
  (known ? test.failing : test)(known ? `presses (known app bug: ${known})` : "presses", async () => {
    const Screen = require(`~/app/${route.file}`).default;
    const { screen, client } = await renderRoute(Screen, { mode: "rich", params: route.params, segments: route.segments });
    const find = () => roles.flatMap(role => screen.queryAllByRole(role) as unknown as Element[]);
    const total = Math.min(find().length, 60);
    const failures: string[] = [];
    for (let index = 0; index < total; index++) {
      const element = find()[index];
      if (!element) break;
      if (process.env.DUMP) process.stdout.write(`press ${route.file} #${index} ${label(element)} fetching=${client.isFetching()}\n`);
      try {
        // A handler that waits for a confirmation sheet never resolves on its own: the sheet's
        // buttons are pressed later in the same crawl.
        await Promise.race([fireEvent.press(element as never), new Promise(resolve => setTimeout(resolve, 300))]);
        await settle(client);
      } catch (error) {
        failures.push(`${label(element)}: ${error instanceof Error ? `${error.message}\n${error.stack?.split("\n").slice(0, 6).join("\n")}` : String(error)}`);
      }
    }
    if (process.env.DUMP) process.stdout.write(`\n--- ${route.file}: pressed ${total}; posts: ${apiState.calls.filter(call => call.method === "POST").map(call => call.operation).join(", ")}; pushes: ${routerState.router.push.mock.calls.length}\n`);
    expect(failures).toEqual([]);
    expect(unhandled).toEqual([]);
    expect(loggedCrashes()).toEqual([]);
  });
});
