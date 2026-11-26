/** iPad runs OutClass natively in every orientation; iPhones stay portrait (QA_LOG.md D7). */
// Required at run time so the test project doesn't typecheck app.config.ts (it uses Node's fs and path).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config: unknown = require("../../app.config").default;
type Resolved = { orientation: string; ios: { supportsTablet: boolean; infoPlist: Record<string, string[]> } };
const resolved = (typeof config === "function" ? config({ config: {}, projectRoot: process.cwd() }) : config) as Resolved;

test("iPad is supported natively, in every orientation and so in Split View", () => {
  expect(resolved.ios.supportsTablet).toBe(true);
  expect(resolved.ios.infoPlist["UISupportedInterfaceOrientations~ipad"]).toEqual(expect.arrayContaining(["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"]));
});

test("iPhones keep the portrait lock", () => expect(resolved.orientation).toBe("portrait"));
