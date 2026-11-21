/** In-memory expo-router state the mock reads: the route's params and a router of spies. */
export const routerState = {
  params: {} as Record<string, string | string[] | undefined>,
  segments: ["(tabs)"] as string[],
  pathname: "/",
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
}
