"use client"
import { Eye } from "@/components/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ApplicantProfileFacts } from "@/components/views/leader-dashboard/applicant-profile-facts"
import { profilePhotoSource } from "@/lib/profile-photo"
import { profileFieldKeys, type ProfileFieldVisibility } from "@/lib/profile-field-visibility"
import { recruitmentProfile } from "@/lib/recruitment-profile"
import { resolveResumeUrl, type FullStudentProfile } from "@/lib/student-profile"

// Every field a club can turn on; each club chooses which of them its reviewers see.
const everyClubField = Object.fromEntries(profileFieldKeys.map(key => [key, true])) as ProfileFieldVisibility

/** The applicant view club reviewers get, built from the same projection they read (gender stays off unless a round enables it). */
export function StudentProfilePreview({ profile }: { profile: FullStudentProfile }) {
  const view = recruitmentProfile(profile)
  const resume = resolveResumeUrl(view.resumeUrl)
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline" size="sm"><Eye className="size-4" aria-hidden="true" />Preview</Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>What clubs see</DialogTitle>
        <DialogDescription>Reviewers see these details when you apply. Each club chooses which ones it shows.</DialogDescription>
      </DialogHeader>
      <section aria-label="Profile as clubs see it" className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 shrink-0"><AvatarImage src={profilePhotoSource(view.headshotUrl)} alt="" /><AvatarFallback className="bg-secondary text-sm font-medium text-primary">{view.firstName[0]}{view.lastName[0]}</AvatarFallback></Avatar>
          <div className="min-w-0"><p className="font-medium break-words">{view.firstName} {view.lastName}</p>{view.major && <p className="text-sm text-muted-foreground">{view.major}</p>}</div>
        </div>
        <ApplicantProfileFacts profile={view} fields={everyClubField} resume={resume ? <a href={resume} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Résumé<span className="sr-only"> (opens in a new tab)</span></a> : undefined} />
      </section>
      <p className="text-xs text-muted-foreground">Gender appears only when a club turns it on for a round. Your phone number goes only to a club that accepts you.</p>
    </DialogContent>
  </Dialog>
}
