import { cache } from "react"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { hasWorkspace } from "@/lib/permissions"
import { accountUserInclude } from "@/lib/account-data"

// Per-request only; mutations/other requests still perform live authorization.
export const getCurrentUser = cache(async () => {
  const { user, impersonation } = await requireAuth()
  const data = await prisma.user.findUnique({
    where: { id: user.id },
    include: accountUserInclude,
  })
  if (!data || data.disabledAt) throw new Error("Account unavailable")
  return { ...data, impersonating: !!impersonation, profile: data.studentProfile, adminRoles: data.memberships.filter(hasWorkspace) }
})
