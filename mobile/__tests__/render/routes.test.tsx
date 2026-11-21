/**
 * Renders every route in src/app against the rich, empty and refusal fixtures and fails on a
 * render-time crash, a crash React logged, a call with no fixture, or missing expected text.
 */
import { captureConsole, loggedCrashes, missingFixtures, releaseConsole, renderRoute, screenText } from "./harness";
import { routes } from "./routes";

beforeEach(captureConsole);
afterEach(releaseConsole);

const modes = ["rich", "empty", "error"] as const;

describe.each(routes)("$file", route => {
  for (const mode of modes) {
    const known = route.failing?.[mode];
    (known ? test.failing : test)(known ? `${mode} (known app bug: ${known})` : mode, async () => {
      const Screen = require(`~/app/${route.file}`).default;
      const { screen } = await renderRoute(Screen, { mode, params: route.params, segments: route.segments, providers: !route.ownProviders });
      // DUMP=1 prints what the screen shows, for writing expectations.
      if (process.env.DUMP) process.stdout.write(`\n--- ${route.file} (${mode})\n${screenText(screen.toJSON())}\n`);
      expect(missingFixtures()).toEqual([]);
      for (const text of route[mode] ?? []) {
        const found = screen.queryAllByText(text, typeof text === "string" ? { exact: false, includeHiddenElements: true } : { includeHiddenElements: true });
        if (!found.length) throw new Error(`Expected text ${String(text)} in ${route.file} (${mode})`);
      }
      expect(loggedCrashes()).toEqual([]);
    });
  }
});

/** Deep links can carry anything: every route with params must survive a missing or malformed one. */
const BAD = "not-a-real-id";
describe.each(routes.filter(route => route.params))("$file with bad params", route => {
  const cases = { missing: {}, malformed: Object.fromEntries(Object.keys(route.params!).map(key => [key, BAD])) };
  for (const [name, params] of Object.entries(cases)) {
    const known = route.failing?.[name as "missing" | "malformed"];
    (known ? test.failing : test)(known ? `${name} params (known app bug: ${known})` : `${name} params`, async () => {
      const Screen = require(`~/app/${route.file}`).default;
      const { screen } = await renderRoute(Screen, { mode: "rich", params, strictInputs: true });
      if (process.env.DUMP) process.stdout.write(`\n--- ${route.file} (${name} params)\n${screenText(screen.toJSON())}\n`);
      expect(missingFixtures()).toEqual([]);
      expect(screenText(screen.toJSON()).trim().length).toBeGreaterThan(0);
      expect(loggedCrashes()).toEqual([]);
    });
  }
});
