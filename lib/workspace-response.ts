/** Plain JSON for workspace reads. Compression is left to the platform: since
 * Next 15.5.29 the server drops a Content-Encoding header that a route sets
 * itself (it assumes the body may have been decoded), so a body gzipped here
 * would reach the browser as unreadable bytes.
 */
export async function workspaceJsonResponse(data: unknown, _request: Request, initialHeaders: HeadersInit) {
  const headers = new Headers(initialHeaders)
  headers.set("Content-Type", "application/json")
  // The platform may still compress the bytes per client, so caches must key on it.
  headers.append("Vary", "Accept-Encoding")
  return new Response(JSON.stringify(data), { headers })
}
