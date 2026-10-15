"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { accountInitials, profilePhotoSource, type AccountIdentity } from "@/lib/profile-photo"
import { cn } from "@/lib/utils"

export function AccountAvatar({ user, className }: { user?: AccountIdentity | null; className?: string }) {
  const source = profilePhotoSource(user?.profile?.headshotUrl)
  return <Avatar className={cn("size-8", className)} aria-hidden="true">
    {source && <AvatarImage src={source} alt="" />}
    <AvatarFallback>{accountInitials(user)}</AvatarFallback>
  </Avatar>
}
