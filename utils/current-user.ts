import { cache } from "react"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { hasWorkspace } from "@/lib/permissions"

// Per-request only; mutations/other requests still perform live authorization.
export const getCurrentUser = cache(async () => {
  const { user, impersonation } = await requireAuth()
  const data = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      studentProfile: true,
      applications: { omit: { anonymousReviewText: true }, include: { club: true } },
      memberships: { where: { status: "ACTIVE" }, include: { club: true } },
    },
  })
  if (!data || data.disabledAt) throw new Error("Account unavailable")
  return { ...data, impersonating: !!impersonation, profile: data.studentProfile, adminRoles: data.memberships.filter(hasWorkspace) }
})
