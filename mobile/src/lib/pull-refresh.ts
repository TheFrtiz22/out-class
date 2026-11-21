import { useCallback, useRef, useState } from "react";

/**
 * Pull-to-refresh for a screen: `refreshing` is true only while a pull's own refetches run.
 * A query's `isRefetching` is also true for focus refetches and invalidations (after a submit, an
 * accepted offer, a return to the screen), and on iOS a RefreshControl set to refreshing by code
 * shows the spinner and nudges the content down, so tying the two together made it appear on its own.
 */
export function usePullRefresh(...refetchers: (() => unknown)[]) {
  const [refreshing, setRefreshing] = useState(false);
  // The latest closures, so a pull refetches what the screen shows now (a list of clubs can grow).
  const latest = useRef(refetchers);
  latest.current = refetchers;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // A refetcher that throws or rejects still ends the pull.
    void Promise.allSettled(latest.current.map(refetch => Promise.resolve().then(refetch))).finally(() => setRefreshing(false));
  }, []);
  return { refreshing, onRefresh };
}
