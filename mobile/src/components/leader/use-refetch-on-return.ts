import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Coming back to a screen that sat in the stack (a pop, not a remount) reads it again, so a session that
 * ended or a meeting that opened meanwhile shows without a pull. The first focus is the screen's own load.
 */
export function useRefetchOnReturn(refetch: () => unknown) {
  const latest = useRef(refetch);
  latest.current = refetch;
  const seen = useRef(false);
  useFocusEffect(useCallback(() => {
    if (seen.current) latest.current();
    seen.current = true;
  }, []));
}
