"use server"

import { cookies } from "next/headers"
import { RATE_LIMITS } from "@/lib/rate-limit"
import { limitAction } from "@/lib/rate-limit-action"
import { createClient } from "@/utils/supabase/server"

const collection = "outclass_public_clubs_v1"

/**
 * The verified account id for keying the search limit, or null when signed out. Only the JWT's signature is
 * checked (getClaims), which is enough for a limiter key: it never grants access to anything.
 */
async function searchUserId() {
  try {
    const jar = await cookies()
    if (!jar.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))) return null
    const { data, error } = await (await createClient(jar)).auth.getClaims()
    return !error && typeof data?.claims.sub === "string" ? data.claims.sub : null
  } catch { return null }
}

/** Only public directory IDs are returned. Private records are never indexed or queried here. */
export async function searchPublicClubIds(input: string): Promise<string[] | null> {
  const query = input.trim().slice(0, 120)
  if (query.length < 2) return null
  const host = process.env.TYPESENSE_URL
  const key = process.env.TYPESENSE_SEARCH_KEY
  // Unconfigured or unhealthy Typesense should not break current Discover search.
  if (!host || !key) return null
  // Over the limit, Discover falls back to its local directory filter, as when Typesense is down.
  const userId = await searchUserId()
  if (!(await limitAction(userId ? RATE_LIMITS.searchUser : RATE_LIMITS.searchAnonymous, { userId })).ok) return null
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
