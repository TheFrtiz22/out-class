import { getSessionUser } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { isUvaEmail } from "@/lib/auth"
import { hasWorkspace } from "@/lib/permissions"

/** Public authentication entries never infer platform access or grant permissions. */
export async function getAuthEntryAccount() {
  const { data: { user }, error } = await getSessionUser()
  if (error || !user?.email_confirmed_at || !user.email || !isUvaEmail(user.email)) return null
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      disabledAt: true,
      studentProfile: { select: { id: true } },
      memberships: {
        where: { status: "ACTIVE", club: { suspendedAt: null } },
        orderBy: { clubId: "asc" },
        select: { clubId: true, status: true, isOwner: true, permissions: true, interviewOffices: true },
      },
    },
  })
  const club = account?.memberships.find(hasWorkspace)
  return {
    user,
    disabled: !!account?.disabledAt,
    hasProfile: !!account?.studentProfile,
    destination: club ? `/club/${encodeURIComponent(club.clubId)}/workspace` : "/?workspace=student",
  }
}
