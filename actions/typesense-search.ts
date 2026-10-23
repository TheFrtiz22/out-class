"use server"

const collection = "outclass_public_clubs_v1"

/** Only public directory IDs are returned. Private records are never indexed or queried here. */
export async function searchPublicClubIds(input: string): Promise<string[] | null> {
  const query = input.trim().slice(0, 120)
  if (query.length < 2) return null
  const host = process.env.TYPESENSE_URL
  const key = process.env.TYPESENSE_SEARCH_KEY
  // Unconfigured or unhealthy Typesense should not break current Discover search.
  if (!host || !key) return null
  try {
    const url = new URL(host)
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost" && url.protocol === "http:")) return null
    url.pathname = `/collections/${collection}/documents/search`
    url.search = new URLSearchParams({
      q: query,
      query_by: "name,category,tagline,description",
      query_by_weights: "6,2,3,1",
      num_typos: "2,1,2,2",
      prefix: "true",
      per_page: "250",
      include_fields: "id",
    }).toString()
    const response = await fetch(url, { headers: { "X-TYPESENSE-API-KEY": key }, cache: "no-store", signal: AbortSignal.timeout(1800) })
    if (!response.ok) return null
    const data: unknown = await response.json()
    if (!data || typeof data !== "object" || !("hits" in data) || !Array.isArray(data.hits)) return null
    return data.hits.flatMap((hit: unknown) => {
      if (!hit || typeof hit !== "object" || !("document" in hit)) return []
      const doc = hit.document
      return doc && typeof doc === "object" && "id" in doc && typeof doc.id === "string" ? [doc.id] : []
    })
  } catch { return null }
}
