/** In-memory expo-router state the mock reads: the route's params and a router of spies. */
export const routerState = {
  params: {} as Record<string, string | string[] | undefined>,
  segments: ["(tabs)"] as string[],
  pathname: "/",
  /** The tab the mocked Tabs starts on, and the root stack index under it (above 0: a copy of the tabs over another screen).
   * Not reset per render: a test that sets them puts them back. */
  tabIndex: 0,
  stackIndex: 0,
  /** The tab bar's event emitter (a tap on the tab you are on sends `tabPress`). */
  tabEmit: jest.fn(() => ({ defaultPrevented: false })),
  router: {
    push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), dismiss: jest.fn(), dismissAll: jest.fn(), dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), setParams: jest.fn(), prefetch: jest.fn(),
  },
};

export function resetRouter(params: Record<string, string | string[] | undefined> = {}, segments: string[] = ["(tabs)"], pathname = "/") {
  routerState.params = params;
  routerState.segments = segments;
  routerState.pathname = pathname;
  for (const fn of Object.values(routerState.router)) fn.mockClear();
  routerState.tabEmit.mockClear();
}
