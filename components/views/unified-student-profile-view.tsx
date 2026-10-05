"use client"
import { scholarNames } from "@/lib/scholar-status"

import { useEffect, useState, type ReactNode } from "react"
import { ArrowUpRight, Check, FileText, Linkedin, Pencil } from "lucide-react"
import { getStudentProfile } from "@/lib/workspace-api"
import { useAuth } from "@/contexts/auth-context"
import {
  profileChecklist,
  safeProfileUrl, resolveResumeUrl,
  type FullStudentProfile,
  type ProfileSection,
} from "@/lib/student-profile"
import type { StudentMembership } from "@/lib/data"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EditStudentProfileDialog } from "@/components/edit-student-profile-dialog"

export type ProfileMembership = StudentMembership

export function UnifiedStudentProfileView() {
  const { user, loading } = useAuth()
  const [profile, setProfile] = useState<FullStudentProfile | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
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
      <div aria-busy="true" aria-label="Loading profile" className="max-w-4xl space-y-8">
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
        <h2 className="oc-section-heading ">Your story starts here.</h2>
        <p className="text-muted-foreground">
          {user
            ? "Complete student onboarding to create your recruiting profile."
            : "Sign in to see your saved education, experience, and résumé. This preview contains no sample personal details."}
        </p>
      </div>
    )
  const checklist = profileChecklist(profile)
  const completed = checklist.filter((item) => item.complete).length
  function edit(section: ProfileSection) {
    return (
      <EditStudentProfileDialog
        profile={profile!}
        section={section}
        onSaved={(value) => {
          setProfile(value)
          setSaved(true)
        }}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit ${section === "identity" ? "name and photo" : section}`}
            className="shrink-0 text-muted-foreground"
          >
            <Pencil className="size-3.5" />
            <span>{section === "experience" ? "Edit structured experience" : "Edit"}</span>
          </Button>
        }
      />
    )
  }
  function section(title: string, key: ProfileSection, children: ReactNode, description?: string) {
    return (
      <section aria-label={title} className="border-t border-border py-8 sm:py-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="oc-card-heading ">{title}</h3>
          {edit(key)}
        </div>
        {description && (
          <p className="mb-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {children}
      </section>
    )
  }
  return (
    <article className="oc-student-profile mx-auto max-w-5xl text-foreground">
      <p role="status" className="sr-only">
        {saved ? "Profile changes saved." : ""}
      </p>
      <header className="flex items-start gap-5 pb-9 sm:gap-7 sm:pb-12">
        <Avatar className="size-24 shrink-0 sm:size-32">
          <AvatarImage src={safeProfileUrl(profile.headshotUrl)} alt="" />
          <AvatarFallback className="bg-secondary text-xl font-medium text-primary sm:text-3xl">
            {profile.firstName[0]}
            {profile.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
            University of Virginia
          </p>
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
          {edit("identity")}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm">
            {safeProfileUrl(profile.linkedinUrl) && (
              <a
                href={safeProfileUrl(profile.linkedinUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
              >
                <Linkedin className="size-4" />
                LinkedIn<span className="sr-only"> (opens in a new tab)</span>
                <ArrowUpRight className="size-3" />
              </a>
            )}
            {resolveResumeUrl(profile.resumeUrl) && (
              <a
                href={resolveResumeUrl(profile.resumeUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
              >
                <FileText className="size-4" />
                View résumé<span className="sr-only"> (opens in a new tab)</span>
                <ArrowUpRight className="size-3" />
              </a>
            )}
          </div>
        </div>
      </header>
      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
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
              {!!scholarNames(profile.scholarStatus).length && <p className="mt-2 text-sm"><span className="text-muted-foreground">Scholar status: </span>{scholarNames(profile.scholarStatus).join(", ")}</p>}
              {(profile.gpa != null || profile.satScore != null || profile.actScore != null) && (
                <dl className="mt-4 flex flex-wrap gap-6 text-sm">
                  {profile.gpa != null && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">GPA</dt>
                      <dd>{profile.gpa.toFixed(2)} / 4.00</dd>
                    </div>
                  )}
                  {profile.actScore != null && <div><dt className="text-muted-foreground">ACT</dt><dd>{profile.actScore}</dd></div>}
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
        </div>
        <aside className="border-t border-border pt-8 lg:pt-10">
          <h3 className="oc-card-heading ">Make it yours</h3>
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
                  {item.complete && <Check className="size-3" />}
                </span>
                {item.label}
                <span className="sr-only">{item.complete ? " added" : " not yet added"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <h3 className="oc-card-heading ">Links & résumé</h3>
              {edit("links")}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Add your LinkedIn link and a résumé document. Automatic profile import is not
              available.
            </p>
          </div>
          <div className="mt-4">{edit("experience")}</div>
        </aside>
      </div>
    </article>
  )
}
