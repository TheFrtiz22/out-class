"use client"
import { profilePhotoSource } from "@/lib/profile-photo"
import { scholarSummary } from "@/lib/scholar-status"

import { useEffect, useState, type ReactNode } from "react"
import { Check, Pencil } from "@/components/icons"
import { getStudentProfile } from "@/lib/workspace-api"
import { useAuth } from "@/contexts/auth-context"
import {
  formatGpa, gpaSchema, profileChecklist, resolveResumeUrl, safeProfileUrl,
  type FullStudentProfile,
  type ProfileSection,
} from "@/lib/student-profile"
import type { StudentMembership } from "@/lib/data"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StudentProfilePreview } from "@/components/student-profile-preview"
import { gpaLabel } from "@/lib/recruitment-profile"
import { ResumeImportDialog } from "@/components/resume-import-dialog"
import { formatPhone } from "@/lib/phone"
import { EditStudentProfileDialog } from "@/components/edit-student-profile-dialog"
import { Panel } from "@/components/ui/panel"
import { AlumniDetailsPanel } from "@/components/alumni-details-panel"

export type ProfileMembership = StudentMembership

export function UnifiedStudentProfileView({ settings = false }: { settings?: boolean } = {}) {
  const { user, loading } = useAuth()
  const [profile, setProfile] = useState<FullStudentProfile | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  // Keeps the checklist (and the editor opened from it) on screen until the student closes the editor, even once every item is added.
  const [checklistEditing, setChecklistEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    setProfile(null)
    setError(false)
    if (loading)
      return () => {
        active = false
      }
    if (!user) {
      setPending(false)
      return
    }
    setPending(true)
    getStudentProfile()
      .then((result) => {
        if (active) setProfile(result.profile)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setPending(false)
      })
    return () => {
      active = false
    }
  }, [user?.id, loading, retry])
  if (loading || pending)
    return (
      <div role="status" aria-busy="true" className="max-w-[var(--oc-content-width)] space-y-8">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-52 w-full" />
        <span className="sr-only">Loading profile</span>
      </div>
    )
  if (error)
    return (
      <div role="alert" className="space-y-4">
        <h2 className="oc-section-heading ">Your profile couldn’t load</h2>
        <p className="text-muted-foreground">Your saved details haven’t changed.</p>
        <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </Button>
      </div>
    )
  if (!profile)
    return (
      <div className="max-w-xl space-y-3 py-10">
        <h2 className="oc-section-heading ">Complete your student profile.</h2>
        <p className="text-muted-foreground">
          {user
            ? "Complete student onboarding to create your recruiting profile."
            : "Sign in to see your saved education, experience, and résumé. This preview contains no sample personal details."}
        </p>
      </div>
    )
  const checklist = profileChecklist(profile)
  const completed = checklist.filter((item) => item.complete).length
  const allAdded = completed === checklist.length
  const showChecklist = !allAdded || checklistEditing
  // Where each checklist item is edited, so "Add missing details" opens on the first one still missing.
  const checklistSection: Record<string, ProfileSection> = { Name: "identity", Education: "education", "Résumé": "links", Experience: "experience", LinkedIn: "links" }
  const resume = resolveResumeUrl(profile.resumeUrl)
  const linkedin = safeProfileUrl(profile.linkedinUrl)
  // One entry point: "Edit profile" opens every section; "Import from résumé" lives inside it.
  // No key on the editor: autosave updates the checklist while it is open, and a new key would close it mid-edit.
  const editDialog = (trigger: ReactNode, section?: ProfileSection, onOpenChange?: (open: boolean) => void) => <EditStudentProfileDialog
    section={section}
    onOpenChange={onOpenChange}
    profile={profile!}
    sections={["identity", "education", "experience", "links", "contact"]}
    extra={sync => <ResumeImportDialog key={profile!.userId} profile={profile!} label="Import from résumé" onSaved={value => { setProfile(value); setSaved(true); sync(value) }} />}
    onSaved={(value) => { setProfile(value); setSaved(true) }}
    trigger={trigger}
  />
  const editProfile = editDialog(<Button size="sm"><Pencil className="size-3.5" aria-hidden="true" />Edit profile</Button>)
  function section(title: string, key: ProfileSection, children: ReactNode, description?: string) {
    return (
      <Panel as="section" aria-label={title}>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="oc-card-heading ">{title}</h3>
        </div>
        {description && (
          <p className="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {children}
      </Panel>
    )
  }
  return (
    <article className={`oc-student-profile max-w-[var(--oc-content-width)] text-foreground${settings ? " oc-settings-profile" : ""}`}>
      <p role="status" className="sr-only">
        {saved ? "Profile changes saved." : ""}
      </p>
      <header className={`flex items-start gap-5 ${settings ? "pb-5 sm:gap-5" : "oc-profile-identity pb-6 sm:gap-6 sm:pb-8"}`}>
        <Avatar className={settings ? "size-20 shrink-0" : "size-20 shrink-0 sm:size-24"}>
          <AvatarImage src={profilePhotoSource(profile.headshotUrl)} alt="" />
          <AvatarFallback className="bg-secondary text-xl font-medium text-primary sm:text-3xl">
            {profile.firstName[0]}
            {profile.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="oc-section-heading break-words">
            {profile.firstName} {profile.lastName}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {profile.major}
            <span className="px-2" aria-hidden="true">
              ·
            </span>
            Class of {profile.gradYear}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {editProfile}
            <StudentProfilePreview profile={profile} />
          </div>
        </div>
      </header>
      {/* Once every suggested detail is added, the checklist has nothing left to say, so the sections take the full width. */}
      <div className={`grid items-start gap-[var(--oc-content-gap)]${showChecklist ? " lg:grid-cols-[minmax(0,1fr)_16rem]" : ""}`}>
        <div className="oc-workspace-stack">
          {section(
            "Education",
            "education",
            <div>
              <div className="flex flex-wrap justify-between gap-2">
                <h4 className="font-medium">University of Virginia</h4>
                <span className="text-sm tabular-nums text-muted-foreground">
                  Class of {profile.gradYear}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{profile.major}</p>
              {profile.highSchool && <p className="mt-2 text-sm">High school: {profile.highSchool}</p>}
              {(profile.gender || profile.pronouns) && <p className="mt-2 text-sm">{[profile.gender && `Gender: ${profile.gender}`, profile.pronouns && `Pronouns: ${profile.pronouns}`].filter(Boolean).join(" · ")}</p>}
              {profile.gender && <p className="mt-1 text-xs text-muted-foreground">Clubs see your gender only when they turn it on for a round.</p>}
              {profile.transferStudent && <p className="mt-2 text-sm">Transfer student</p>}
              <p className="mt-2 text-sm"><span className="text-muted-foreground">Scholar status: </span>{scholarSummary(profile.scholarStatus) ?? <span className="text-muted-foreground">Not provided</span>}</p>
              {(profile.gpa != null || profile.satScore != null || profile.actScore != null) && (
                <dl className="mt-4 flex flex-wrap gap-6 text-sm">
                  {profile.gpa != null && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">{gpaLabel(profile)}</dt>
                      <dd>{gpaSchema.safeParse(profile.gpa).success ? `${formatGpa(profile.gpa)} / 4.00` : `${profile.gpa} · Confirm a GPA out of 4.0 in Education`}</dd>
                    </div>
                  )}
                  {profile.actScore != null && <div className="flex gap-2"><dt className="text-muted-foreground">ACT</dt><dd>{profile.actScore}</dd></div>}
                  {profile.satScore != null && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">SAT</dt>
                      <dd>{profile.satScore}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>,
          )}
          {section(
            "Experience",
            "experience",
            profile.experiences.length ? <ul className="space-y-3">{profile.experiences.map(item => <li key={item.id} className="text-sm"><p className="font-medium">{item.title}</p>{(item.subtitle || item.period) && <p className="text-muted-foreground">{[item.subtitle, item.period].filter(Boolean).join(" · ")}</p>}</li>)}</ul>
              : <p className="text-sm text-muted-foreground">Not added. Add roles, jobs or activities in Edit profile.</p>,
          )}
          {section(
            "Résumé and links",
            "links",
            <ul className="space-y-2 text-sm">
              <li>{resume ? <a href={resume} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">View résumé<span className="sr-only"> (opens in a new tab)</span></a> : <span className="text-muted-foreground">No résumé added. Upload one in Edit profile.</span>}</li>
              <li>{linkedin ? <a href={linkedin} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">LinkedIn profile<span className="sr-only"> (opens in a new tab)</span></a> : <span className="text-muted-foreground">No LinkedIn added.</span>}</li>
            </ul>,
          )}
          {section(
            "Phone",
            "contact",
            <p className="text-sm tabular-nums">{formatPhone(profile.phone) || <span className="text-muted-foreground">Not added. Required before you submit an application.</span>}</p>,
            "Clubs call applicants they accept. Only a club that accepts you sees your number.",
          )}
          <AlumniDetailsPanel key={profile.userId} profile={profile} />
        </div>
        {showChecklist && <Panel as="aside">
          <h3 className="oc-card-heading ">Profile details</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {completed} of {checklist.length} profile details added. These are suggestions, not
            application requirements.
          </p>
          <div
            role="progressbar"
            aria-label="Profile details added"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={checklist.length}
            className="my-4 h-1 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${(completed / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="space-y-2.5">
            {checklist.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full ${item.complete ? "bg-secondary text-primary" : "border border-border"}`}
                >
                  {item.complete && <Check className="size-3.5" />}
                </span>
                {item.label}
                <span className="sr-only">{item.complete ? " added" : " not yet added"}</span>
              </li>
            ))}
          </ul>
          {/* The checklist ends with the way to finish it, so a missing detail isn't a dead end. */}
          <div className="mt-4" data-checklist-action>{editDialog(<Button size="sm" variant="outline"><Pencil className="size-3.5" aria-hidden="true" />Add missing details</Button>, checklistSection[checklist.find(item => !item.complete)?.label ?? ""], setChecklistEditing)}</div>
        </Panel>}
      </div>
    </article>
  )
}
