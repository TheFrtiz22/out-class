"use client"

import { useEffect, useState, type ReactNode, type FormEvent } from "react"
import { profilePhotoSource } from "@/lib/profile-photo"
import { ProfilePhotoCrop } from "@/components/profile-photo-crop"
import { Plus, Trash2 } from "lucide-react"
import { getStudentProfile, updateStudentProfileSection } from "@/lib/workspace-api"
import { uploadProfileFile } from "@/lib/workspace-api"
import { useAuth } from "@/contexts/auth-context"
import { gpaSchema, genderValues, pronounValues, type FullStudentProfile, type ProfileSection } from "@/lib/student-profile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { scholarPrograms, scholarLabels, scholarStatusSchema, toggleScholar } from "@/lib/scholar-status"

const titles = {
  identity: "Name & photo",
  education: "Education",
  experience: "Experience",
  links: "Links & résumé",
}
export function EditStudentProfileDialog({
  trigger,
  profile,
  section = "identity",
  onSaved,
}: {
  trigger?: ReactNode
  profile?: FullStudentProfile
  section?: ProfileSection
  onSaved?: (profile: FullStudentProfile) => void
}) {
  const { user, refreshUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FullStudentProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null)
  const [originalGpa, setOriginalGpa] = useState<number | null>(null)
  const [scholarYes, setScholarYes] = useState(false)
  const [photoSource, setPhotoSource] = useState<string | null>(null)
  useEffect(() => () => { if (photoSource?.startsWith("blob:")) URL.revokeObjectURL(photoSource) }, [photoSource])
  async function begin(value: boolean) {
    if (busy) return
    setOpen(value)
    setPhotoSource(null)
    setError("")
    if (!value) return
    setDraft(profile || null)
    setOriginalGpa(profile?.gpa ?? null)
    setOriginalPhoto(profile?.headshotUrl ?? null)
    setScholarYes(!!(profile?.scholarStatus as { selections?: string[] } | null)?.selections?.some(v => v !== "NOT_APPLICABLE"))
    if (!profile && user) {
      try {
        const loaded = (await getStudentProfile()).profile
        setDraft(loaded)
        setOriginalGpa(loaded?.gpa ?? null)
        setOriginalPhoto(loaded?.headshotUrl ?? null)
        setScholarYes(!!(loaded?.scholarStatus as { selections?: string[] } | null)?.selections?.some(v => v !== "NOT_APPLICABLE"))
        if (!loaded) setError("Complete student onboarding before editing your profile.")
      } catch {
        setError("We couldn’t load your profile. Close this window and try again.")
      }
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    if (section === "education") {
      if (scholarYes && !draft.scholarStatus) { setError("Choose at least one scholar program."); return }
      const scholar = scholarStatusSchema.safeParse(draft.scholarStatus ?? null)
      if (!scholar.success) { setError(scholar.error.issues[0].message); return }
    }
    setBusy(true)
    setError("")
    try {
      const payload =
        section === "identity"
          ? { section, firstName: draft.firstName, lastName: draft.lastName, ...(draft.headshotUrl !== originalPhoto ? { headshotUrl: draft.headshotUrl } : {}) }
          : section === "education"
            ? {
                section,
                highSchool: draft.highSchool, gender: draft.gender, pronouns: draft.pronouns, transferStudent: draft.transferStudent,
                major: draft.major,
                gradYear: draft.gradYear,
                scholarStatus: draft.scholarStatus ?? null,
                ...(draft.gpa !== originalGpa ? { gpa: draft.gpa } : {}),
                satScore: draft.satScore,
                actScore: draft.actScore, actEnglish: draft.actEnglish, actMath: draft.actMath, actReading: draft.actReading, actScience: draft.actScience,
              }
            : section === "experience"
              ? { section, experiences: draft.experiences }
              : { section, linkedinUrl: draft.linkedinUrl, resumeUrl: draft.resumeUrl }
      const result = await updateStudentProfileSection(payload)
      if ("error" in result) {
        setError(result.error || "Unable to save.")
        return
      }
      onSaved?.(result.profile)
      setOpen(false)
      await refreshUser()
    } catch {
      setError("Your changes could not be saved. Please try again.")
    } finally {
      setBusy(false)
    }
  }
  async function upload(file?: File, kind: "resume" | "headshot" = "resume") {
    if (!file || !draft) return
    setBusy(true); setError("")
    try {
      const payload = new FormData(); payload.set("file", file); payload.set("kind", kind)
      const { reference } = await uploadProfileFile(payload)
      setDraft(current => current ? { ...current, [kind === "resume" ? "resumeUrl" : "headshotUrl"]: reference } : current)
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Your saved profile has not changed."); if (kind === "headshot") throw e }
    finally { setBusy(false) }
  }
  function field(
    key: "firstName" | "lastName" | "highSchool" | "major" | "linkedinUrl" | "resumeUrl",
    label: string,
    required = false,
  ) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`profile-${key}`}>{label}</Label>
        <Input
          id={`profile-${key}`}
          required={required}
          type="text"
          inputMode={key.endsWith("Url") ? "url" : undefined}
          value={draft?.[key] || ""}
          onChange={(event) =>
            setDraft((current) => (current ? { ...current, [key]: event.target.value } : current))
          }
        />
      </div>
    )
  }
  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Edit {titles[section].toLowerCase()}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        style={{ width: "min(36rem, calc(100vw - 2rem))", maxHeight: "calc(100dvh - 2rem)", minHeight: 0, overflowY: "auto" }}
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{titles[section]}</DialogTitle>
          <DialogDescription>Update this section of your recruiting profile.</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!user ? (
          <p className="text-sm text-muted-foreground">Sign in to edit your saved profile.</p>
        ) : !draft ? (
          <p role="status">
            {error ? "Close this window to return to your profile." : "Loading profile…"}
          </p>
        ) : (
          <form onSubmit={save} className="space-y-6">
            <fieldset disabled={busy} className="min-w-0 space-y-5">
              {section === "identity" && (
                <>
                  {field("firstName", "First name", true)}
                  {field("lastName", "Last name", true)}
                  <div className="space-y-2">
                    <Label htmlFor="profile-headshot">Profile photo (JPEG, PNG or WebP, up to 5 MB)</Label>
                    <Input
                      id="profile-headshot"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={event => {
                        const file = event.target.files?.[0]
                        if (file) { if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) setError("Choose a JPEG, PNG or WebP image up to 5 MB."); else { setError(""); setPhotoSource(URL.createObjectURL(file)) } }
                        event.target.value = ""
                      }}
                    />
                    {photoSource && <ProfilePhotoCrop source={photoSource} onCancel={() => setPhotoSource(null)} onSave={async file => { await upload(file, "headshot"); setPhotoSource(null) }} />}
                    {draft.headshotUrl && <Button type="button" variant="outline" onClick={() => setPhotoSource(profilePhotoSource(draft.headshotUrl) ?? null)}>Re-edit photo</Button>}
                    <Button type="button" variant="ghost" onClick={() => { setPhotoSource(null); setDraft({ ...draft, headshotUrl: null }) }}>Remove photo</Button>
                    <p className="text-xs text-muted-foreground">Save changes to update your photo.</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your computing ID is managed by your university account.
                  </p>
                </>
              )}
              {section === "education" && (
                <>
                  {field("major", "Major / intended major", true)}
                  <div className="space-y-2">
                    <Label htmlFor="profile-year">Graduation year</Label>
                    <Input
                      id="profile-year"
                      type="number"
                      required
                      min={2020}
                      max={2030}
                      value={draft.gradYear}
                      onChange={(event) =>
                        setDraft({ ...draft, gradYear: Number(event.target.value) })
                      }
                    />
                  </div>
                  {field("highSchool", "High school (optional)")}
                  <div className="grid gap-4 sm:grid-cols-2">{([["gender", "Gender", genderValues], ["pronouns", "Pronouns", pronounValues]] as const).map(([key, label, values]) => <div className="space-y-2" key={key}><Label htmlFor={`profile-${key}`}>{label}</Label><select id={`profile-${key}`} className="w-full rounded-md border bg-background p-2" value={draft[key] ?? ""} onChange={e => setDraft({ ...draft, [key]: e.target.value || null })}><option value="">Not provided</option>{values.map(v => <option key={v}>{v}</option>)}</select></div>)}</div>
                  <p className="text-xs text-muted-foreground">Gender is shared with recruitment reviewers only when explicitly enabled for the round. Pronouns and high school stay on your personal profile.</p>
                  <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.transferStudent} onChange={e => setDraft({ ...draft, transferStudent: e.target.checked })} />Transfer student</label>
                  <fieldset className="space-y-3"><legend className="text-sm font-medium">Are you a scholar?</legend>
                    <select aria-label="Are you a scholar?" className="rounded-md border bg-background p-2" value={scholarYes ? "yes" : draft.scholarStatus ? "no" : ""} onChange={e => { setScholarYes(e.target.value === "yes"); setDraft({ ...draft, scholarStatus: e.target.value === "no" ? { selections: ["NOT_APPLICABLE"], other: "" } : null }) }}><option value="">Not provided</option><option value="yes">Yes</option><option value="no">No</option></select>
                    {scholarYes && <div className="grid gap-3 sm:grid-cols-2">{scholarPrograms.map(selection => <label key={selection} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={!!(draft.scholarStatus as { selections?: string[] } | null)?.selections?.includes(selection)} onChange={e => setDraft({ ...draft, scholarStatus: toggleScholar(draft.scholarStatus, selection, e.target.checked) })} />{scholarLabels[selection]}</label>)}</div>}
                  </fieldset>
                  <div className="grid grid-cols-2 gap-4">
                    {(
                      [
                        ["gpa", "GPA out of 4.0 (optional)", 0, 4, ".001"],
                        ["satScore", "SAT (optional)", 400, 1600, "1"],
                        ["actScore", "ACT composite (optional)", 1, 36, "1"],
                        ["actEnglish", "ACT English (optional)", 1, 36, "1"],
                        ["actMath", "ACT Math (optional)", 1, 36, "1"],
                        ["actReading", "ACT Reading (optional)", 1, 36, "1"],
                        ["actScience", "ACT Science (optional)", 1, 36, "1"],
                      ] as const
                    ).map(([key, label, min, max, step]) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`profile-${key}`}>{label}</Label>
                        <Input
                          id={`profile-${key}`}
                          type="number"
                          {...(key === "gpa" && draft.gpa === originalGpa && draft.gpa != null && !gpaSchema.safeParse(draft.gpa).success ? { step: "any" } : { min, max, step })}
                          value={draft[key] ?? ""}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              [key]: event.target.value === "" ? null : Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {section === "experience" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Include internships, research, projects, or leadership. Add your most recent
                    work first; dates are displayed as you enter them.
                  </p>
                  {draft.experiences.map((experience, index) => (
                    <fieldset key={index} className="space-y-3 border-b border-border pb-5">
                      <legend className="mb-3 text-sm font-medium">Experience {index + 1}</legend>
                      {(
                        [
                          ["title", "Role or project"],
                          ["subtitle", "Organization / context"],
                          ["period", "Dates"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="space-y-2">
                          <Label htmlFor={`experience-${index}-${key}`}>{label}</Label>
                          <Input
                            id={`experience-${index}-${key}`}
                            required={key !== "period"}
                            value={experience[key]}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                experiences: draft.experiences.map((item, i) =>
                                  i === index ? { ...item, [key]: event.target.value } : item,
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            experiences: draft.experiences.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                        Remove experience {index + 1}
                      </Button>
                    </fieldset>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={draft.experiences.length >= 50}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        experiences: [
                          ...draft.experiences,
                          {
                            id: `new-${draft.experiences.length}`,
                            studentProfileId: draft.id,
                            title: "",
                            subtitle: "",
                            period: "",
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="size-4" />
                    Add experience
                  </Button>
                </>
              )}
              {section === "links" && (
                <>
                  {field("linkedinUrl", "LinkedIn URL")}
                  {field("resumeUrl", "Résumé URL")}
                  <div className="space-y-2">
                    <Label htmlFor="profile-upload">Or upload a résumé (PDF, up to 10 MB)</Label>
                    <Input
                      id="profile-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={(event) => {
                        void upload(event.target.files?.[0])
                        event.target.value = ""
                      }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Save to attach this document to your profile. Clear the résumé URL to remove the
                    attachment. LinkedIn and résumé details are not imported automatically.
                  </p>
                </>
              )}
            </fieldset>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !!photoSource}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
