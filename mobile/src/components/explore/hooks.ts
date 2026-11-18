import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import type { ClubDirectory, PublicClub, SavedClubs } from "~/lib/types";

const SAVED_CLUBS = ["clubs.saved", null] as const;
const SAVED_EVENTS = ["events.savedIds", null] as const;

/** The public directory: one read shared by Explore and anything that needs a club's summary. */
export function useDirectory() {
  return useApiQuery<ClubDirectory>("explore.directory", undefined, { staleTime: 60_000 });
}

/** A club's full public profile, by id or slug. Prefetched on press-in from every list that opens it. */
export const clubQuery = (club: string) => ({
  queryKey: ["club", { club }] as const,
  queryFn: ({ signal }: { signal?: AbortSignal }) => api.get<{ club: PublicClub | null; error?: string }>("club", { club }, { signal }),
  staleTime: 60_000,
});
export function usePrefetchClub() {
  const queryClient = useQueryClient();
  return useCallback((club: string) => { void queryClient.prefetchQuery(clubQuery(club)); }, [queryClient]);
}

/**
 * Saved clubs (the web's Corkboard context): the account's list plus an explicit, idempotent
 * save or remove. The change shows at once and is restored if the server refuses, with the
 * server's own message (an alumni account, a club that is no longer available).
 */
export function useSavedClubs(onRefused?: (message: string) => void) {
  const queryClient = useQueryClient();
  const query = useApiQuery<SavedClubs>("clubs.saved");
  const mutation = useMutation({
    mutationFn: ({ club, saved }: { club: PublicClub; saved: boolean }) => api.post<{ saved: boolean; savedAt: string | null }>("clubs.save", { clubId: club.id, saved }),
    onMutate: async ({ club, saved }) => {
      await queryClient.cancelQueries({ queryKey: SAVED_CLUBS });
      const previous = queryClient.getQueryData<SavedClubs>(SAVED_CLUBS);
      queryClient.setQueryData<SavedClubs>(SAVED_CLUBS, current => {
        const rest = (current?.items ?? []).filter(item => item.club.id !== club.id);
        return { items: saved ? [{ club, savedAt: new Date().toISOString() }, ...rest] : rest };
      });
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(SAVED_CLUBS, context?.previous);
      haptics.error();
      onRefused?.(errorMessage(error, "Couldn’t save this change."));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SAVED_CLUBS }),
  });
  const items = query.data?.items;
  const ids = useMemo(() => new Set((items ?? []).map(item => item.club.id)), [items]);
  const { mutate } = mutation;
  const setSaved = useCallback((club: PublicClub, saved: boolean) => { haptics.save(); mutate({ club, saved }); }, [mutate]);
  return { query, items: items ?? [], ids, setSaved };
}

/** Saved events (components/events/use-saved-campus-events.ts), optimistic with rollback. */
export function useSavedEvents(onRefused?: (message: string) => void) {
  const queryClient = useQueryClient();
  const query = useApiQuery<string[]>("events.savedIds");
  const mutation = useMutation({
    mutationFn: ({ eventId, saved }: { eventId: string; saved: boolean }) => api.post<{ saved: boolean }>("events.save", { eventId, saved }),
    onMutate: async ({ eventId, saved }) => {
      await queryClient.cancelQueries({ queryKey: SAVED_EVENTS });
      const previous = queryClient.getQueryData<string[]>(SAVED_EVENTS);
      queryClient.setQueryData<string[]>(SAVED_EVENTS, current => {
        const rest = (current ?? []).filter(id => id !== eventId);
        return saved ? [...rest, eventId] : rest;
      });
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(SAVED_EVENTS, context?.previous);
      haptics.error();
      onRefused?.(errorMessage(error, "Couldn’t save this event. Try again."));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SAVED_EVENTS });
      // A board filtered to saved events changes with every save.
      void queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "events.board" && (query.queryKey[1] as { savedOnly?: boolean } | null)?.savedOnly === true });
    },
  });
  const data = query.data;
  const ids = useMemo(() => new Set(data ?? []), [data]);
  const { mutate } = mutation;
  const setSaved = useCallback((eventId: string, saved: boolean) => { haptics.save(); mutate({ eventId, saved }); }, [mutate]);
  return { query, ids, ready: query.isSuccess, setSaved };
}
