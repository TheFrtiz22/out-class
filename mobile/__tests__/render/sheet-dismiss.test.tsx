/**
 * Closing a bottom sheet (the scrim, a drag, Back, the owner closing it) must never take the app
 * down. On iOS the app closed when a sheet was dismissed: the sheet unmounted its still-presented
 * Modal from an animation callback on the UI thread. Now the close runs from JavaScript and the
 * Modal is hidden (visible=false) before its content goes.
 *
 * The second half opens every sheet on every screen (by pressing each button) and closes it with
 * the scrim, checking that it goes away and nothing crashed.
 */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";
import { GestureHandlerRootView, State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { SHEET_CLOSE_MS, Sheet } from "~/components/sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "~/lib/theme";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { routes } from "./routes";

beforeEach(captureConsole);
afterEach(releaseConsole);

const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const closed = () => wait(SHEET_CLOSE_MS + 120);

function Harness({ initial = true, dismissible = true, keepOpen = false }: { initial?: boolean; dismissible?: boolean; keepOpen?: boolean }) {
  const [open, setOpen] = useState(initial);
  const [closes, setCloses] = useState(0);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <ThemeProvider>
        <Text testID="closes">{String(closes)}</Text>
        <Text testID="reopen" onPress={() => setOpen(true)}>Reopen</Text>
        <Sheet open={open} onClose={() => { setCloses(count => count + 1); if (!keepOpen) setOpen(false); }} dismissible={dismissible} title="Notification settings" testID="sheet">
          <Text>Sheet body</Text>
        </Sheet>
      </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}


describe("closing a sheet", () => {
  test("tapping outside slides it away, hides the Modal, then drops its content", async () => {
    await render(<Harness />);
    expect(screen.getByText("Sheet body")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId("sheet-scrim", { includeHiddenElements: true })); });
    expect(screen.getByTestId("closes").props.children).toBe("1");
    // Still on screen while it slides out.
    expect(screen.queryByText("Sheet body")).toBeTruthy();
    await closed();
    expect(screen.queryByText("Sheet body")).toBeNull();
    expect(screen.queryByTestId("sheet-scrim", { includeHiddenElements: true })).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("dragging it down past a third of the screen closes it", async () => {
    await render(<Harness />);
    await act(async () => {
      fireGestureHandler(getByGestureTestId("sheet-drag"), [
        { state: State.BEGAN, translationY: 0, velocityY: 0 },
        { state: State.ACTIVE, translationY: 20, velocityY: 400 },
        { translationY: 500, velocityY: 1800 },
        { state: State.END, translationY: 600, velocityY: 1800 },
      ]);
    });
    expect(screen.getByTestId("closes").props.children).toBe("1");
    await closed();
    expect(screen.queryByText("Sheet body")).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("Back (the Modal's close request) closes it", async () => {
    await render(<Harness />);
    await act(async () => { fireEvent(screen.getByTestId("sheet", { includeHiddenElements: true }), "requestClose"); });
    expect(screen.getByTestId("closes").props.children).toBe("1");
    await closed();
    expect(screen.queryByText("Sheet body")).toBeNull();
  });

  test("the screen going away while the sheet slides out leaves nothing running", async () => {
    function Screen() {
      const [shown, setShown] = useState(true);
      return <>{shown ? <Harness /> : null}<Text testID="leave" onPress={() => setShown(false)}>Leave</Text></>;
    }
    await render(<Screen />);
    await act(async () => { fireEvent.press(screen.getByTestId("sheet-scrim", { includeHiddenElements: true })); });
    await act(async () => { fireEvent.press(screen.getByTestId("leave")); });
    expect(screen.queryByText("Sheet body")).toBeNull();
    await closed();
    expect(loggedCrashes()).toEqual([]);
  });

  test("opening it again while it slides out keeps it open", async () => {
    await render(<Harness />);
    await act(async () => { fireEvent.press(screen.getByTestId("sheet-scrim", { includeHiddenElements: true })); });
    await wait(SHEET_CLOSE_MS / 3);
    await act(async () => { fireEvent.press(screen.getByTestId("reopen")); });
    await closed();
    expect(screen.getByText("Sheet body")).toBeTruthy();
  });

  test("a sheet that can't be dismissed (a save running) ignores the scrim", async () => {
    await render(<Harness dismissible={false} />);
    await act(async () => { fireEvent.press(screen.getByTestId("sheet-scrim", { includeHiddenElements: true })); });
    await closed();
    expect(screen.getByTestId("closes").props.children).toBe("0");
    expect(screen.getByText("Sheet body")).toBeTruthy();
  });

  test("a sheet dragged away whose owner keeps it open comes back", async () => {
    await render(<Harness keepOpen />);
    await act(async () => {
      fireGestureHandler(getByGestureTestId("sheet-drag"), [
        { state: State.BEGAN, translationY: 0 }, { state: State.ACTIVE, translationY: 20 }, { translationY: 600, velocityY: 1800 }, { state: State.END, translationY: 600, velocityY: 1800 },
      ]);
    });
    await closed();
    expect(screen.getByText("Sheet body")).toBeTruthy();
    expect(screen.getByTestId("sheet-scrim", { includeHiddenElements: true })).toBeTruthy();
  });
});

describe("every sheet on every screen closes cleanly", () => {
  const roles = ["button", "link", "switch"] as const;
  type Element = { props: Record<string, unknown> };
  describe.each(routes.filter(route => !route.ownProviders && !route.failing?.rich && !route.file.endsWith("_layout")))("$file", route => {
    test("open each sheet, then close it from outside", async () => {
      const Screen = require(`~/app/${route.file}`).default;
      const { client } = await renderRoute(Screen, { mode: "rich", params: route.params, segments: route.segments });
      const find = () => roles.flatMap(role => screen.queryAllByRole(role) as unknown as Element[]).filter(element => element.props.testID !== "sheet-scrim");
      const total = Math.min(find().length, 40);
      const opened: string[] = [];
      for (let index = 0; index < total; index++) {
        const element = find()[index];
        if (!element) break;
        await Promise.race([fireEvent.press(element as never), new Promise(resolve => setTimeout(resolve, 300))]);
        await settle(client);
        const scrims = screen.queryAllByTestId("sheet-scrim", { includeHiddenElements: true }).filter(scrim => scrim.props.accessible !== false);
        if (!scrims.length) continue;
        opened.push(String(element.props.accessibilityLabel ?? element.props.testID ?? index));
        await act(async () => { fireEvent.press(scrims[scrims.length - 1]); });
        await closed();
        await settle(client);
      }
      expect(loggedCrashes()).toEqual([]);
      // Whatever opened went away again (a sheet that can't be dismissed while busy may stay).
      expect(screen.queryAllByTestId("sheet-scrim", { includeHiddenElements: true }).filter(scrim => scrim.props.accessible !== false)).toEqual([]);
      if (process.env.DUMP) process.stdout.write(`${route.file}: closed ${opened.length} sheet(s): ${opened.join(", ")}\n`);
    });
  });
});
