import { hideDevToolsButton } from "~/lib/dev-tools";

describe("developer tools button", () => {
  it("hides the floating gear in development builds", () => {
    const setToolsButtonVisible = jest.fn(() => Promise.resolve());
    expect(hideDevToolsButton(true, undefined, () => ({ setToolsButtonVisible }))).toBe(true);
    expect(setToolsButtonVisible).toHaveBeenCalledWith(false);
  });

  it("leaves release builds alone", () => {
    const setToolsButtonVisible = jest.fn();
    expect(hideDevToolsButton(false, undefined, () => ({ setToolsButtonVisible }))).toBe(false);
    expect(setToolsButtonVisible).not.toHaveBeenCalled();
  });

  it("keeps the gear when asked to", () => {
    const setToolsButtonVisible = jest.fn();
    expect(hideDevToolsButton(true, "1", () => ({ setToolsButtonVisible }))).toBe(false);
    expect(setToolsButtonVisible).not.toHaveBeenCalled();
  });

  it("does nothing when the developer menu module is missing or fails", async () => {
    expect(hideDevToolsButton(true, undefined, () => null)).toBe(false);
    expect(hideDevToolsButton(true, undefined, () => { throw new Error("no module"); })).toBe(false);
    const rejecting = jest.fn(() => Promise.reject(new Error("not ready")));
    expect(hideDevToolsButton(true, undefined, () => ({ setToolsButtonVisible: rejecting }))).toBe(true);
    await Promise.resolve();
  });
});
