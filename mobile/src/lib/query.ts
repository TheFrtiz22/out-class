import { QueryClient, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { api, ApiError } from "~/lib/api";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        // Refusals are answers, not faults: only connection failures and outages are retried.
        retry: (count, error) => count < 2 && (!(error instanceof ApiError) || error.offline || error.status >= 500),
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
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
