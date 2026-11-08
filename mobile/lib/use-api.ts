import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Minimal GET hook with refresh. Replace with a query cache when screens multiply. */
export function useApi<T>(path: `/api/v1/${string}`) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, refresh: load };
}
