import { SITE_URL } from "@/lib/seo"

/** One school's public scope: the School row (prisma/schema.prisma) that Club.schoolId points at. */
export type SchoolScope = { id: string; key: string }

/** The launch school. Club.schoolId and Club.campusKey default to it, and the main domain shows it. */
export const DEFAULT_SCHOOL: SchoolScope = { id: "school-uva", key: "uva" }

const APEX = new URL(SITE_URL).hostname.replace(/^www\./, "")
const NOT_SCHOOLS = new Set(["www"])

/**
 * The School.key a request's host names: `<key>.out-class.net` (and `<key>.localhost` outside
 * production). The apex, www and any other host (Vercel preview URLs included) name no school.
 */
export function schoolKeyFromHost(host: string | null | undefined, production = process.env.NODE_ENV === "production"): string | null {
  const name = (host || "").trim().toLowerCase().replace(/:\d+$/, "")
  for (const apex of production ? [APEX] : [APEX, "localhost"]) {
    if (!name.endsWith(`.${apex}`)) continue
    const label = name.slice(0, -apex.length - 1)
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) && !NOT_SCHOOLS.has(label) ? label : null
  }
  return null
}

/** Absolute origin for a school's public pages: the main site for the launch school, otherwise its subdomain. */
export function schoolOrigin(school: SchoolScope): string {
  return school.id === DEFAULT_SCHOOL.id ? SITE_URL : `https://${school.key}.${APEX}`
}
