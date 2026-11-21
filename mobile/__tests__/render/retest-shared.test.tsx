/** Nov 21 retest: app-wide fixes (deep links kept through sign-in, club initials, scanner status bar, not-found). */
import { fireEvent, screen } from "@testing-library/react-native";
import { clubInk } from "~/components/ui";
import { pendingLinkFor } from "~/lib/pending-link";
import { captureConsole, releaseConsole, renderRoute } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

describe("club initials", () => {
  test("navy on light club colours, white on dark ones", () => {
    expect(clubInk("#EAAA00")).toBe("#232d4b");
    expect(clubInk("#ffffff")).toBe("#232d4b");
    expect(clubInk("#fff")).toBe("#232d4b");
    expect(clubInk("#142d4e")).toBe("#ffffff");
    expect(clubInk("#e57200")).toBe("#ffffff");
    expect(clubInk("#232d4bff")).toBe("#ffffff");
  });
});

describe("links opened while signed out", () => {
  test("a check-in code, meeting or event is kept for after sign-in", () => {
    expect(pendingLinkFor("/q/abc123", "q")).toBe("/q/abc123");
    expect(pendingLinkFor("/meeting/7d1c", "meeting")).toBe("/meeting/7d1c");
  });
  test("search params come along, but not the ones already in the path", () => {
    expect(pendingLinkFor("/voting/s1", "voting", { sessionId: "s1", clubId: "c9" }, ["voting", "[sessionId]"])).toBe(
      "/voting/s1?clubId=c9",
    );
    expect(pendingLinkFor("/decision", "decision", { letterId: "l 2" }, ["decision"])).toBe("/decision?letterId=l+2");
    expect(pendingLinkFor("/meeting/7d1c", "meeting", { id: "7d1c" }, ["meeting", "[id]"])).toBe("/meeting/7d1c");
  });
  test("Home and the account screens are not", () => {
    expect(pendingLinkFor("/", "(tabs)")).toBeNull();
    expect(pendingLinkFor("/sign-in", "sign-in")).toBeNull();
    expect(pendingLinkFor("/sign-up", "sign-up")).toBeNull();
    expect(pendingLinkFor("/complete-profile", "complete-profile")).toBeNull();
    expect(pendingLinkFor(undefined, undefined)).toBeNull();
  });
});

describe("not-found screen", () => {
  test("offers a way home", async () => {
    const NotFound = require("~/app/+not-found").default;
    await renderRoute(NotFound);
    fireEvent.press(screen.getByText("Go to Home"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/");
  });
});
