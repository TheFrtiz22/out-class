import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Returning to a screen whose last load failed (the server was unreachable, the phone was offline)
 * tries again, so a tab never stays on "You're offline" after the connection is back.
 */
export function useRefetchOnFocus(query: { isError: boolean; isFetching: boolean; refetch: () => unknown }) {
  const latest = useRef(query);
  latest.current = query;
  useFocusEffect(useCallback(() => {
    const current = latest.current;
    if (current.isError && !current.isFetching) current.refetch();
  }, []));
}
