/**
 * Settings → Interview schedule works in the app against the web's own operation
 * (actions/official-panel-schedule.ts `getMyInterviewPanelSchedule`).
 */
import { fireEvent, screen } from "@testing-library/react-native";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const Screen = () => require("~/app/settings/interviews").default;
const panel = (n: number) => `interview-panel-00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("settings overview", () => {
  test("Interview schedule opens in the app, not on the web", async () => {
    await renderRoute(require("~/app/settings/index").default);
    await fireEvent.press(screen.getByTestId("settings-interviews"));
    expect(routerState.router.push).toHaveBeenCalledWith("/settings/interviews");
  });
});

describe("interview schedule", () => {
  test("lists upcoming published panels soonest first, with the web's details", async () => {
    await renderRoute(Screen());
    const cards = screen.getAllByTestId(/^interview-panel-[^-]+-[^-]+-[^-]+-[^-]+-[^-]+$/);
    expect(cards.map(card => card.props.testID)).toEqual([panel(1501), panel(1500)]);
    expect(screen.getByText("Virginia Motorsports · First round interviews")).toBeTruthy();
    expect(screen.getByText("Panel A · Thornton Hall E316")).toBeTruthy();
    expect(screen.getByText("Eastern Time · 10 minute buffer · Official assignment · Published version 3")).toBeTruthy();
    expect(screen.getByText("Eastern Time · Official assignment · Availability overridden · Published version 1")).toBeTruthy();
    expect(screen.getAllByText("Published")).toHaveLength(2);
    expect(screen.queryByText("Panel C · Clark Hall 107")).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("Include past interviews shows the past panel too", async () => {
    await renderRoute(Screen());
    await fireEvent(screen.getByTestId("interviews-include-past"), "valueChange", true);
    expect(screen.getByText("Panel C · Clark Hall 107")).toBeTruthy();
    expect(screen.getByText("Past")).toBeTruthy();
  });

  test("Add to Calendar opens the system sheet with the panel's time and place", async () => {
    const Calendar = jest.requireMock("expo-calendar");
    await renderRoute(Screen());
    await fireEvent.press(screen.getByTestId(`${panel(1501)}-calendar`));
    expect(Calendar.createEventInCalendarAsync).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Virginia Motorsports interview panel", location: "Thornton Hall E316", notes: "First round interviews · Panel A", timeZone: "America/New_York" }));
    expect(screen.getByText("Added to your calendar.")).toBeTruthy();
  });

  test("Update my availability opens the availability screen", async () => {
    await renderRoute(Screen());
    await fireEvent.press(screen.getByTestId("interviews-update-availability"));
    expect(routerState.router.push).toHaveBeenCalledWith("/settings/availability");
  });

  test("with no panels it says when they will appear", async () => {
    await renderRoute(Screen(), { mode: "empty" });
    expect(screen.getByText("You have no upcoming official panel assignments. Draft suggestions appear here after the owner publishes them.")).toBeTruthy();
  });

  test("a failed load shows the reason and a retry", async () => {
    await renderRoute(Screen(), { mode: "error" });
    expect(screen.getByText(/test refusal/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});
