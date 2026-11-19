import { focusManager, onlineManager, QueryClient, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState } from "react-native";
import { api, ApiError } from "~/lib/api";

let wired = false;
/**
 * React Native has no window focus or online events, so TanStack Query is told directly: returning
 * to the foreground counts as focus (stale screens refetch), and the device's connection drives
 * refetch-on-reconnect. Requests still run while the device reports no connection (networkMode
 * "always"), so a screen shows the offline message and Retry instead of waiting silently, and a
 * button never stays busy on a paused mutation.
 */
function wireReactNative() {
  if (wired) return;
  wired = true;
  focusManager.setEventListener(onFocus => {
    const subscription = AppState.addEventListener("change", state => onFocus(state === "active"));
    return () => subscription.remove();
  });
  onlineManager.setEventListener(setOnline => {
    const apply = (state: Network.NetworkState) => setOnline(state.isConnected !== false);
    Network.getNetworkStateAsync().then(apply).catch(() => {});
    const subscription = Network.addNetworkStateListener(apply);
    return () => subscription.remove();
  });
}

/** Refusals are answers, not faults: only connection failures and outages are retried, and a timed-out read once. */
export function shouldRetry(count: number, error: unknown): boolean {
  if (!(error instanceof ApiError)) return count < 2;
  if (error.code === "TIMEOUT") return count < 1;
  return count < 2 && (error.offline || error.status >= 500);
}

export function createQueryClient() {
  wireReactNative();
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: shouldRetry,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        networkMode: "always",
      },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

/** A read of one mobile API operation, cached under [operation, input]. */
export function useApiQuery<T>(operation: string, input?: unknown, options: Partial<UseQueryOptions<T, Error>> & { anonymous?: boolean; scope?: string } = {}) {
  const { anonymous, scope, ...rest } = options;
  return useQuery<T, Error>({
    queryKey: scope ? [scope, operation, input ?? null] : [operation, input ?? null],
    queryFn: ({ signal }) => api.get<T>(operation, input, { signal, anonymous }),
    ...rest,
  });
}
