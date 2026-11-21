/**
 * Profile → After graduation is edited in the app with the web's own action (actions/graduation.ts
 * saveAlumniDetails), with the same fields and choices as components/alumni-details-fields.tsx.
 */
import { resolveTheme } from "@outclass/shared/tokens";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { ApiError } from "~/lib/api";
import { apiState } from "./api-state";
import { fixtureSets } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";

beforeEach(captureConsole);
afterEach(releaseConsole);

const Screen = () => require("~/app/(tabs)/profile").default;
const base = (fixtureSets.rich.profile as { profile: Record<string, unknown> }).profile;
const graduated = { profile: { ...base, graduatedAt: "2025-05-20T12:00:00.000Z", graduationConfirmedAt: "2025-04-10T12:00:00.000Z", postGradEmployer: "Acme", postGradRole: "Analyst", alumniDirectoryVisible: true, alumniPlacementShare: true } };
const posts = (operation: string) => apiState.calls.filter(call => call.method === "POST" && call.operation === operation).map(call => call.input);

describe("after graduation details", () => {
  test("Edit opens the details in the app and Save sends them", async () => {
    const { client } = await renderRoute(Screen(), { overrides: { profile: graduated } });
    expect(screen.queryByLabelText(/Edit your after-graduation details on the site/)).toBeNull();
    await fireEvent.press(screen.getByTestId("profile-after-graduation-edit"));
    expect(screen.getByTestId("alumni-employer").props.value).toBe("Acme");
    await fireEvent.changeText(screen.getByTestId("alumni-employer"), "  Acme Robotics ");
    await fireEvent.changeText(screen.getByTestId("alumni-role"), "");
    await fireEvent(screen.getByTestId("alumni-share-employer"), "valueChange", false);
    await fireEvent.press(screen.getByTestId("alumni-save"));
    await settle(client);
    expect(posts("graduation.details")).toEqual([{ employer: "Acme Robotics", role: null, showInAlumniList: true, shareEmployer: false }]);
    expect(apiState.calls.filter(call => call.operation === "profile").length).toBeGreaterThanOrEqual(2);
    expect(loggedCrashes()).toEqual([]);
  });

  test("on a small phone the fields scroll and Save stays in view", async () => {
    await renderRoute(Screen(), { overrides: { profile: graduated } });
    await fireEvent.press(screen.getByTestId("profile-after-graduation-edit"));
    const scroll = screen.getByTestId("alumni-details-scroll");
    expect(within(scroll).getByTestId("alumni-employer")).toBeTruthy();
    expect(within(scroll).getByTestId("alumni-show-in-list")).toBeTruthy();
    expect(within(scroll).queryByTestId("alumni-save")).toBeNull();
    expect(screen.getByTestId("alumni-save")).toBeTruthy();
    const style = [scroll.props.style].flat().reduce((all, part) => ({ ...all, ...part }), {});
    expect(style.maxHeight).toBeLessThan(852);
  });

  test("in Dark the sheet uses dark colours only", async () => {
    await AsyncStorage.setItem("outclass.appearance", "dark");
    const values = (mode: "light" | "dark") => new Set(Object.values(resolveTheme(mode).colors as unknown as Record<string, string>).filter(value => typeof value === "string").map(value => value.toLowerCase()));
    const light = values("light"), dark = values("dark");
    const { toJSON } = await renderRoute(Screen(), { overrides: { profile: graduated } });
    await fireEvent.press(screen.getByTestId("profile-after-graduation-edit"));
    const found: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      const { props, children } = node as { props?: { style?: unknown }; children?: unknown };
      for (const part of [props?.style].flat(Infinity as 1) as Record<string, unknown>[]) for (const key of ["color", "backgroundColor", "borderColor"]) if (part && typeof part[key] === "string") found.push((part[key] as string).toLowerCase());
      walk(children);
    };
    walk(toJSON());
    expect(found.some(colour => dark.has(colour) && !light.has(colour))).toBe(true);
    expect(found.filter(colour => light.has(colour) && !dark.has(colour))).toEqual([]);
    await AsyncStorage.clear();
    expect(loggedCrashes()).toEqual([]);
  });

  test("a refused entry keeps the sheet open with the server's reason", async () => {
    const { client } = await renderRoute(Screen(), { overrides: { profile: graduated, "graduation.details": () => { throw new ApiError(400, "VALIDATION", "Enter just the employer name, without links or email addresses."); } } });
    await fireEvent.press(screen.getByTestId("profile-after-graduation-edit"));
    await fireEvent.changeText(screen.getByTestId("alumni-employer"), "acme.com");
    await fireEvent.press(screen.getByTestId("alumni-save"));
    await settle(client);
    expect(screen.getByText("Enter just the employer name, without links or email addresses.")).toBeTruthy();
    expect(screen.getByTestId("alumni-employer").props.value).toBe("acme.com");
  });

  test("a student who hasn't confirmed graduation doesn't see the section", async () => {
    await renderRoute(Screen());
    expect(screen.queryByTestId("profile-after-graduation")).toBeNull();
  });
});
