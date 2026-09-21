import { useState } from "react"
import { GraduationCap } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ClubLogo } from "@/components/club-logo"
import { EditStudentProfileDialog } from "@/components/edit-student-profile-dialog"
import { Button } from "@/components/ui/button"
import { MemberPortalDialog } from "@/components/views/member-portal-dialog"
import { currentStudent, studentMemberships as mockStudentMemberships } from "@/lib/data"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"

export type ProfileMembership = {
  clubId: string;
  clubName: string;
  logoText: string;
  color: string;
  role: string;
  title?: string;
  logoUrl?: string | null;
};

export function UnifiedStudentProfileView() {
  const { user } = useAuth()
  
  const studentMemberships: ProfileMembership[] = user?.memberships ? user.memberships.map((m: ExtendedMembership) => ({
    clubId: m.clubId,
    clubName: m.club.name,
    logoText: m.club.name.substring(0, 2),
    color: m.club.color || "#000",
    role: m.role === 'PRESIDENT' || m.role === 'RECRUITMENT_LEAD' ? "Executive" : "Member",
    title: m.title || undefined,
  })) : mockStudentMemberships

  const [selectedMembership, setSelectedMembership] = useState<ProfileMembership | null>(null)

  const profileName = user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : currentStudent.name
  const profileInitials = user?.profile ? `${user.profile.firstName[0]}${user.profile.lastName[0]}` : currentStudent.initials
  const profileMajor = user?.profile?.major || currentStudent.major
  const profileYear = user?.profile ? `Class of ${user.profile.gradYear}` : currentStudent.classYear

  return (
    <div className="min-h-full space-y-6">
      <div className="flex items-center justify-end">
        <EditStudentProfileDialog
          trigger={
            <Button className="bg-primary text-white hover:bg-primary/90">Edit Personal Profile</Button>
          }
        />
      </div>

      {/* Core Profile Header */}
      <Card className="border-gray-200 bg-white shadow-none">
        <CardContent className="flex flex-wrap items-center gap-5 p-6">
          <Avatar className="size-24 border-4 border-white shadow-none">
            <AvatarFallback className="bg-foreground text-2xl font-semibold text-white">
              {profileInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-sans">{profileName}</h2>
            <p className="text-sm text-gray-600">{profileMajor}</p>
            <Badge variant="secondary" className="gap-1 border-gray-200 bg-gray-100 font-normal text-gray-700">
              <GraduationCap className="size-3" />
              {profileYear}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Campus Involvement */}
      <div className="space-y-3">
        <h3 className="font-sans text-2xl font-semibold text-foreground tracking-tight">My Clubs</h3>
        <p className="text-sm text-gray-500">Click a club to open its Member Portal.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {studentMemberships.map((membership) => (
            <Card
              key={membership.clubId}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedMembership(membership)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setSelectedMembership(membership)
                }
              }}
              className="cursor-pointer border-gray-200 bg-white shadow-none transition-colors hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5900]"
            >
              <CardContent className="flex items-center gap-3 p-4">
                <ClubLogo clubId={membership.clubId} logoUrl={membership.logoUrl} text={membership.logoText} color={membership.color} size="lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate text-sm font-semibold text-foreground">{membership.clubName}</p>
                  {membership.role === "Executive" ? (
                    <Badge className="border-transparent bg-secondary font-normal text-secondary-foreground">
                      Executive{membership.title ? ` · ${membership.title}` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="border-gray-200 bg-gray-100 font-normal text-gray-700">
                      Member
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <MemberPortalDialog
        membership={selectedMembership}
        open={!!selectedMembership}
        onOpenChange={(open) => !open && setSelectedMembership(null)}
      />
    </div>
  )
}
