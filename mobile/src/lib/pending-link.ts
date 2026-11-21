type Params = Record<string, string | string[] | undefined>;

/**
 * The screen a signed-out person was opening (a /q check-in or club code, a meeting, an event, a voting room) when
 * they were sent to sign in, kept so they land there afterwards instead of on Home. Home itself and the account
 * screens aren't kept. `usePathname()` drops the query string, so search params (a voting room's clubId, a
 * decision's letterId) are added back from the route params, leaving out the ones the path itself already holds.
 */
export function pendingLinkFor(
  pathname: string | null | undefined,
  firstSegment: string | undefined,
  params: Params = {},
  segments: readonly string[] = [],
): string | null {
  if (!pathname || pathname === "/" || !pathname.startsWith("/")) return null;
  if (firstSegment === "sign-in" || firstSegment === "sign-up" || firstSegment === "complete-profile") return null;
  const inPath = new Set(segments.map((s) => s.match(/^\[(?:\.\.\.)?(.+)\]$/)?.[1]).filter(Boolean) as string[]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (inPath.has(key) || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) query.append(key, v);
  }
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
