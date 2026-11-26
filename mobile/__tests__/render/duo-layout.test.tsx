/**
 * The iPhone Duo keeps its camera and status along a side edge, and unfolded its screen is wide and nearly square.
 * Full-width screens add the side safe areas to their gutters. Content isn't centred in a fixed column: unfolded,
 * the centre is the folding region (Apple HIG, Designing for iPhone Duo).
 * Found in the iOS Simulator (iPhone Duo): the sign-in hero and every screen ran under the right-edge status column.
 */
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useScreenGutters } from "~/components/ui";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";

beforeEach(captureConsole);
afterEach(releaseConsole);

const phone = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const duoOpen = { frame: { x: 0, y: 0, width: 880, height: 760 }, insets: { top: 24, left: 0, right: 52, bottom: 20 } };
const duoNarrow = { frame: { x: 0, y: 0, width: 420, height: 760 }, insets: { top: 24, left: 0, right: 52, bottom: 20 } };

function Probe({ base }: { base?: number }) {
  const g = useScreenGutters(base);
  return <Text testID="gutters">{`${g.left},${g.right}`}</Text>;
}
const gutters = async (metrics: typeof phone, base?: number) => {
  await render(<SafeAreaProvider initialMetrics={metrics}><Probe base={base} /></SafeAreaProvider>);
  return screen.getByTestId("gutters").props.children as string;
};

describe("useScreenGutters", () => {
  test("an iPhone keeps the 16pt gutters", async () => expect(await gutters(phone)).toBe("16,16"));
  test("a narrow screen with a status column on the right adds it to the right gutter", async () => expect(await gutters(duoNarrow)).toBe("16,68"));
  test("an unfolded Duo clears the status column without centring a column across the fold", async () => expect(await gutters(duoOpen)).toBe("16,68"));
  test("bars use their own base gutter", async () => expect(await gutters(duoNarrow, 12)).toBe("12,64"));
});

describe("screens on an unfolded Duo", () => {
  const flat = (style: unknown): Record<string, number | string> => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  test("Home's content and the tab dock stay clear of the right-edge status column", async () => {
    await renderRoute(require("~/app/(tabs)/_layout").default, { mode: "rich", metrics: duoOpen });
    const dock = screen.getByTestId("tab-dock");
    // The dock's positioned wrapper is two levels up (shadow wrapper, then the absolute bar).
    let bar = dock.parent;
    while (bar && flat(bar.props.style).position !== "absolute") bar = bar.parent;
    const style = flat(bar!.props.style);
    expect(style.left).toBe(12);
    expect(style.right).toBe(52 + 12);
    expect(loggedCrashes()).toEqual([]);
  });
  test("a scrolling screen pads its content clear of the status column", async () => {
    await renderRoute(require("~/app/(tabs)/index").default, { mode: "rich", metrics: duoOpen });
    const scroll = screen.getByTestId("home-screen");
    const content = flat(scroll.props.contentContainerStyle);
    expect(content.paddingLeft).toBe(16);
    expect(content.paddingRight).toBe(52 + 16);
    expect(loggedCrashes()).toEqual([]);
  });
});
