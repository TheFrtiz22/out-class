/**
 * Settings screens that used to send people to the website: Interests, Availability and the
 * interview schedule now work in the app, against the same operations the web's pages use.
 */
import { fireEvent, screen } from "@testing-library/react-native";
import { ApiError } from "~/lib/api";
import { apiState } from "./api-state";
import { records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const posts = (operation: string) => apiState.calls.filter(call => call.method === "POST" && call.operation === operation).map(call => call.input);
const alumniMe = { ...records.me, profile: { ...records.me.profile!, graduatedAt: "2025-05-20T12:00:00.000Z" } };

describe("settings overview", () => {
  test("Interests opens in the app, not on the web", async () => {
    const Screen = require("~/app/settings/index").default;
    await renderRoute(Screen);
    await fireEvent.press(screen.getByTestId("settings-interests"));
    expect(routerState.router.push).toHaveBeenCalledWith("/settings/interests");
  });
});

describe("interests", () => {
  const Screen = () => require("~/app/settings/interests").default;

  test("shows the saved answers, and Save sends the edit with the loaded revision", async () => {
    const { client } = await renderRoute(Screen());
    expect(screen.getByText("2 of 6")).toBeTruthy();
    expect(screen.getByTestId("interests-into-tech").props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId("interests-save").props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId("interests-into-arts"));
    await fireEvent.press(screen.getByTestId("interests-goals-service"));
    await fireEvent.press(screen.getByTestId("interests-hours-3-5")); // choosing the chosen time again clears it
    await fireEvent.press(screen.getByTestId("interests-selective-either"));
    expect(screen.getByText("3 of 6")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("interests-save"));
    await settle(client);
    expect(posts("interests.save")).toEqual([{ interests: ["tech", "consulting", "arts"], goals: ["career", "service"], weeklyHours: null, selectivity: "either", revision: 3 }]);
    expect(screen.getByTestId("interests-message").props.children).toBe("Saved");
    expect(screen.getByTestId("interests-save").props.accessibilityState).toMatchObject({ disabled: true });
    // The next save uses the revision the server returned.
    await new Promise(resolve => setTimeout(resolve, 460)); // past the button's double-tap guard
    await fireEvent.press(screen.getByTestId("interests-into-arts"));
    await fireEvent.press(screen.getByTestId("interests-save"));
    await settle(client);
    expect(posts("interests.save")[1]).toMatchObject({ interests: ["tech", "consulting"], revision: 4 });
    expect(loggedCrashes()).toEqual([]);
  });

  test("six interests is the limit: the rest are disabled until one is removed", async () => {
    await renderRoute(Screen());
    for (const id of ["finance", "business", "impact", "arts"]) await fireEvent.press(screen.getByTestId(`interests-into-${id}`));
    expect(screen.getByText("6 of 6")).toBeTruthy();
    expect(screen.getByTestId("interests-into-social").props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId("interests-into-social"));
    expect(screen.getByText("6 of 6")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("interests-into-arts"));
    expect(screen.getByTestId("interests-into-social").props.accessibilityState).toMatchObject({ disabled: false });
  });

  test("a save refused because another device saved first offers the latest answers", async () => {
    const { client } = await renderRoute(Screen(), { overrides: { "interests.save": () => { throw new ApiError(409, "STALE", "Your interests changed in another tab. Reload before saving again."); } } });
    await fireEvent.press(screen.getByTestId("interests-into-arts"));
    await fireEvent.press(screen.getByTestId("interests-save"));
    await settle(client);
    expect(screen.getByText("Your interests changed in another tab. Reload before saving again.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("interests-reload"));
    await settle(client);
    expect(screen.getByText("2 of 6")).toBeTruthy();
    expect(screen.queryByTestId("interests-message")).toBeNull();
  });

  test("Discard returns to the saved answers", async () => {
    await renderRoute(Screen());
    await fireEvent.press(screen.getByTestId("interests-into-arts"));
    await fireEvent.press(screen.getByTestId("interests-discard"));
    expect(screen.getByText("2 of 6")).toBeTruthy();
    expect(screen.queryByTestId("interests-discard")).toBeNull();
  });

  test("an answer the app doesn't know is not sent back", async () => {
    const { client } = await renderRoute(Screen(), { overrides: { interests: { interests: ["tech", "future-option"], goals: ["career", "x"], weeklyHours: "9+", selectivity: "yes", revision: 1, completed: true, dismissed: false } } });
    expect(screen.getByText("1 of 6")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("interests-into-arts"));
    await fireEvent.press(screen.getByTestId("interests-save"));
    await settle(client);
    expect(posts("interests.save")).toEqual([{ interests: ["tech", "arts"], goals: ["career"], weeklyHours: null, selectivity: "yes", revision: 1 }]);
  });

  test("alumni see their answers read-only, with the web's line and no Save", async () => {
    await renderRoute(Screen(), { overrides: { me: alumniMe } });
    expect(screen.getByText("Alumni accounts can’t edit the interest survey. Your answers stay as they are.")).toBeTruthy();
    expect(screen.queryByTestId("interests-save")).toBeNull();
    expect(screen.getByTestId("interests-into-arts").props.accessibilityState).toMatchObject({ disabled: true });
  });

  test("a failed load shows the reason and a retry", async () => {
    await renderRoute(Screen(), { mode: "error" });
    expect(screen.getByText(/test refusal/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});
