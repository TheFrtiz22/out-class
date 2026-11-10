"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

export type ListSort<K extends string> = {
  key: K
  descending: boolean
  /** Sets both parts at once (the dropdown). */
  set: (key: K, descending: boolean) => void
  /** Column-header behavior: the same key flips direction; a new key starts in its natural direction. */
  toggle: (key: K) => void
}

/** Reads `sort` and `order` from a query string, falling back to the list's default for anything unknown. */
export function readListSort<K extends string>(search: Pick<URLSearchParams, "get"> | null | undefined, keys: readonly K[], fallback: K, descendingByDefault: (key: K) => boolean = () => false) {
  const raw = search?.get("sort") ?? null
  const key = raw && (keys as readonly string[]).includes(raw) ? raw as K : fallback
  const order = search?.get("order")
  return { key, descending: order === "desc" ? true : order === "asc" ? false : descendingByDefault(key) }
}

/** Writes the sort into a URL, leaving the default sort out so plain links stay clean. */
export function writeListSort<K extends string>(url: URL, key: K, descending: boolean, fallback: K, descendingByDefault: (key: K) => boolean = () => false) {
  if (key === fallback && descending === descendingByDefault(key)) { url.searchParams.delete("sort"); url.searchParams.delete("order"); return url }
  url.searchParams.set("sort", key)
  url.searchParams.set("order", descending ? "desc" : "asc")
  return url
}

/**
 * One sort state per list, shared by the column headers and the toolbar's Sort control and kept in
 * the URL (`?sort=gpa&order=desc`), so it survives resizes, layout switches and reloads.
 * `keys` should be a stable (module-level) array.
 */
export function useListSort<K extends string>(keys: readonly K[], fallback: K, descendingByDefault: (key: K) => boolean = () => false): ListSort<K> {
  const params = useSearchParams()
  const query = params?.toString() ?? null
  const [state, setState] = useState(() => readListSort(params, keys, fallback, descendingByDefault))
  // Follow the URL (back/forward, links). Outside the app router (isolated fixtures) read it once after mount.
  useEffect(() => {
    const next = readListSort(query === null ? new URLSearchParams(typeof window === "undefined" ? "" : window.location?.search ?? "") : new URLSearchParams(query), keys, fallback, descendingByDefault)
    setState(current => current.key === next.key && current.descending === next.descending ? current : next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys and the default direction are module constants
  }, [query, fallback])
  const set = useCallback((key: K, descending: boolean) => {
    setState(current => current.key === key && current.descending === descending ? current : { key, descending })
    if (typeof window === "undefined" || !window.history || !window.location) return
    const url = writeListSort(new URL(window.location.href), key, descending, fallback, descendingByDefault)
    window.history.replaceState(window.history.state, "", url)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [fallback])
  const toggle = useCallback((key: K) => set(key, key === state.key ? !state.descending : descendingByDefault(key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [set, state.key, state.descending])
  return useMemo(() => ({ ...state, set, toggle }), [state, set, toggle])
}
