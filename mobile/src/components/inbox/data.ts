import { type InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import type { HomeView, InboxRow, InboxRows } from "~/lib/types";

/** The inbox pages (`inbox`, 50 per page, cursor = last row id), shared by every inbox surface. */
export const INBOX_KEY = ["inbox", "pages"] as const;
const HOME_KEY = ["home.view", null] as const;
type Pages = InfiniteData<InboxRows, string | undefined>;

export function useInbox() {
  return useInfiniteQuery<InboxRows, Error, Pages, typeof INBOX_KEY, string | undefined>({
    queryKey: INBOX_KEY,
    queryFn: ({ pageParam, signal }) => api.get<InboxRows>("inbox", pageParam ? { cursor: pageParam } : undefined, { signal }),
    initialPageParam: undefined,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

const chunks = (ids: string[]) => Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ids.slice(index * 100, index * 100 + 100));

/**
 * Read, unread and archive, optimistic with rollback as on the web (lib/application-state.tsx).
 * The unread badge is always the server's number: it is adjusted while the request is in flight
 * and replaced by the server's count when the lists reload.
 */
export function useInboxActions() {
  const client = useQueryClient();

  /** The cache entry a key has now: a new one (or none) once the cache was cleared, as every account change clears it (lib/auth.tsx). */
  const entry = (key: readonly unknown[]) => client.getQueryCache().find({ queryKey: key, exact: true });

  function apply(change: (item: InboxRow) => InboxRow | null) {
    const pages = client.getQueryData<Pages>(INBOX_KEY);
    const home = client.getQueryData<HomeView>(HOME_KEY);
    const entries = { pages: entry(INBOX_KEY), home: entry(HOME_KEY) };
    let delta = 0;
    if (pages) {
      const changed = pages.pages.map(page => ({
        ...page,
        items: page.items.flatMap(item => {
          const next = change(item);
          delta += (next && !next.readAt ? 1 : 0) - (item.readAt ? 0 : 1);
          return next ? [next] : [];
        }),
      }));
      client.setQueryData<Pages>(INBOX_KEY, { ...pages, pages: changed.map(page => ({ ...page, unread: Math.max(0, page.unread + delta) })) });
    }
    if (home && delta) client.setQueryData<HomeView>(HOME_KEY, { ...home, unread: Math.max(0, home.unread + delta), ...(home.inboxUnread === undefined ? {} : { inboxUnread: Math.max(0, home.inboxUnread + delta) }) });
    return { pages, home, entries };
  }
  function rollback(context?: ReturnType<typeof apply>) {
    // A request that fails after a sign-out or account switch must not write the previous account's lists
    // back into the cache the next account reads.
    if (context && ((context.pages && entry(INBOX_KEY) !== context.entries.pages) || (context.home && entry(HOME_KEY) !== context.entries.home))) return;
    if (context?.pages) client.setQueryData(INBOX_KEY, context.pages);
    if (context?.home) client.setQueryData(HOME_KEY, context.home);
    haptics.error();
  }
  const settle = () => { client.invalidateQueries({ queryKey: INBOX_KEY }); client.invalidateQueries({ queryKey: HOME_KEY }); };

  const read = useMutation({
    mutationFn: async ({ ids, read }: { ids: string[]; read: boolean }) => { for (const part of chunks(ids)) await api.post("inbox.read", { ids: part, read }); },
    onMutate: async ({ ids, read }) => {
      await client.cancelQueries({ queryKey: INBOX_KEY });
      const selected = new Set(ids), at = new Date().toISOString();
      return apply(item => (selected.has(item.id) ? { ...item, readAt: read ? item.readAt ?? at : null } : item));
    },
    onError: (_error, _input, context) => rollback(context),
    onSettled: settle,
  });

  const archive = useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => { for (const part of chunks(ids)) await api.post("inbox.archive", { ids: part, archived: true }); },
    onMutate: async ({ ids }) => {
      await client.cancelQueries({ queryKey: INBOX_KEY });
      const selected = new Set(ids);
      return apply(item => (selected.has(item.id) ? null : item));
    },
    onError: (_error, _input, context) => rollback(context),
    onSettled: settle,
  });

  /** Every unread update, including pages not loaded yet (the web pages through them the same way). */
  const readAll = useMutation({
    mutationFn: async () => {
      const ids: string[] = [];
      let cursor: string | undefined;
      // Until the server says there is no next page; the cap only guards against a cursor that never ends.
      for (let page = 0; page < 1_000; page++) {
        const result: InboxRows = await api.get<InboxRows>("inbox", cursor ? { cursor } : undefined);
        ids.push(...result.items.filter(item => !item.readAt).map(item => item.id));
        if (!result.nextCursor || ids.length >= result.unread) break;
        cursor = result.nextCursor;
      }
      for (const part of chunks(ids)) await api.post("inbox.read", { ids: part, read: true });
    },
    onMutate: async () => {
      await client.cancelQueries({ queryKey: INBOX_KEY });
      const at = new Date().toISOString();
      const context = apply(item => (item.readAt ? item : { ...item, readAt: at }));
      // Only the Inbox's own unread clears; task notifications the Inbox doesn't list stay in the total.
      const home = context.home;
      if (home) {
        const cleared = home.inboxUnread ?? context.pages?.pages[0]?.unread ?? home.unread;
        client.setQueryData<HomeView>(HOME_KEY, { ...home, unread: Math.max(0, home.unread - cleared), ...(home.inboxUnread === undefined ? {} : { inboxUnread: 0 }) });
      }
      return context;
    },
    onError: (_error, _input, context) => rollback(context),
    onSuccess: () => haptics.confirm(),
    onSettled: settle,
  });

  return { read, archive, readAll };
}
