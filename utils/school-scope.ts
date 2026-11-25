import { cache } from "react"
import { cookies, headers } from "next/headers"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { getSessionUser } from "@/utils/auth"
import { platformViewSession } from "@/utils/platform-view-as"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { mobileRequest } from "@/utils/mobile-request"
import { DEFAULT_SCHOOL, schoolKeyFromHost, type SchoolScope } from "@/lib/school-host"

const schoolFields = { id: true, key: true } as const
/** A client that can read an account's school: the shared client, or an open transaction. */
type SchoolReader = Pick<AppTransactionClient, "user" | "schoolIdentifierType">

/**
 * The school a signed-in account belongs to: its verified SchoolIdentity (utils/school-identity.ts),
 * else the active school whose identifier type claims the account's email domain. Null when neither.
 */
async function schoolForUser(userId: string, db: SchoolReader = prisma): Promise<SchoolScope | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      schoolIdentities: {
        where: { verifiedAt: { not: null }, school: { active: true } },
        select: { school: { select: schoolFields } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  })
  if (!user) return null
  const verified = user.schoolIdentities[0]?.school
  if (verified) return verified
  const domain = user.email.split("@")[1]?.trim().toLowerCase()
  if (!domain) return null
  const type = await db.schoolIdentifierType.findFirst({
    where: { emailDomain: domain, school: { active: true } },
    select: { school: { select: schoolFields } },
    orderBy: { schoolId: "asc" },
  })
  return type?.school ?? null
}

/**
 * The school of an account already authenticated by the caller (requireAuth's user): the same answer
 * resolveViewerSchool gives, without validating the session a second time. Writes use this; a write
 * that already holds a transaction passes it as `db`, so the lookup does not wait for a second connection.
 */
export async function resolveAccountSchool(userId: string, db: SchoolReader = prisma): Promise<SchoolScope> {
  return (await schoolForUser(userId, db)) ?? resolveHostSchool()
}

/** The effective account: a valid support session's target, otherwise the verified session user.
 * An invalid or expired view-as cookie falls back to the signed-in account, never to the host. */
async function viewerUserId(): Promise<string | null> {
  // The native app's bearer session never consults cookies (utils/mobile-request.ts; getSessionUser verifies the bearer).
  if (!mobileRequest() && (await cookies()).has(PLATFORM_VIEW_COOKIE)) {
    const target = (await platformViewSession().catch(() => null))?.targetUserId
    if (target) return target
  }
  return (await getSessionUser()).data.user?.id ?? null
}

/**
 * The one school whose public clubs and events this request may list. In order:
 * 1. the signed-in account's school (identity-bound, so a host cannot widen it);
 * 2. the school a `<key>.out-class.net` host names; an inactive school's host lists nothing;
 * 3. the launch school (main domain, previews, accounts without a school).
 * Public directory, Explore, search, club pages, campus events and the sitemap all read through
 * this, so a second school never sees the first school's clubs or events.
 */
export const resolveViewerSchool = cache(async (): Promise<SchoolScope> => {
  const userId = await viewerUserId()
  if (userId) {
    const school = await schoolForUser(userId)
    if (school) return school
  }
  return resolveHostSchool()
})

/**
 * The host-named school (or the launch school). Use it for every response a shared cache may hold
 * (sitemap, share-card images, publicly cached assets): those must never depend on the viewer.
 */
export async function resolveHostSchool(): Promise<SchoolScope> {
  const key = schoolKeyFromHost((await headers()).get("host"))
  if (!key) return DEFAULT_SCHOOL
  const school = await prisma.school.findUnique({ where: { key }, select: { ...schoolFields, name: true, active: true } })
  if (!school) return DEFAULT_SCHOOL
  // An id no Club row can carry: an inactive school's host lists nothing rather than another school's clubs.
  return school.active ? { id: school.id, key: school.key, name: school.name } : { id: `inactive:${school.key}`, key: school.key, name: school.name }
}
