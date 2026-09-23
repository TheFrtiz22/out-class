"use client"

import { useState, type ReactNode, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import { getStudentProfile, updateStudentProfileSection } from "@/lib/workspace-api"
import { getSignedUploadUrl } from "@/lib/workspace-api"
import { useAuth } from "@/contexts/auth-context"
import { type FullStudentProfile, type ProfileSection } from "@/lib/student-profile"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const titles = {
  identity: "Introduction",
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
  async function begin(value: boolean) {
    if (busy) return
    setOpen(value)
    setError("")
    if (!value) return
    setDraft(profile || null)
    if (!profile && user) {
      try {
        const loaded = (await getStudentProfile()).profile
        setDraft(loaded)
        if (!loaded) setError("Complete student onboarding before editing your profile.")
      } catch {
        setError("We couldn’t load your profile. Close this window and try again.")
      }
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setBusy(true)
    setError("")
    try {
      const payload =
        section === "identity"
          ? { section, firstName: draft.firstName, lastName: draft.lastName, bio: draft.bio || "" }
          : section === "education"
            ? {
                section,
                major: draft.major,
                gradYear: draft.gradYear,
                gpa: draft.gpa,
                satScore: draft.satScore,
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
  async function upload(file?: File) {
    if (!file || !draft) return
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setError("Choose a PDF up to 10 MB.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const { signedUrl, publicUrl } = await getSignedUploadUrl({
        fileName: file.name,
        bucket: "resumes",
      })
      const response = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      })
      if (!response.ok) throw new Error("Upload failed")
      setDraft((current) => (current ? { ...current, resumeUrl: publicUrl } : current))
    } catch {
      setError("The upload failed. Your existing résumé has not changed. Try again.")
    } finally {
      setBusy(false)
    }
  }
  function field(
    key: "firstName" | "lastName" | "major" | "linkedinUrl" | "resumeUrl",
    label: string,
    required = false,
  ) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`profile-${key}`}>{label}</Label>
        <Input
          id={`profile-${key}`}
          required={required}
          type={key.endsWith("Url") ? "url" : "text"}
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
        className="sm:max-w-xl"
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
                    <Label htmlFor="profile-bio">Introduction</Label>
                    <Textarea
                      id="profile-bio"
                      maxLength={3000}
                      rows={5}
                      placeholder="Your interests, what you’re working on, and what you hope to explore."
                      value={draft.bio || ""}
                      onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
                    />
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
                  <div className="grid grid-cols-2 gap-4">
                    {(
                      [
                        ["gpa", "GPA (optional)", 0, 4, ".01"],
                        ["satScore", "SAT (optional)", 400, 1600, "1"],
                      ] as const
                    ).map(([key, label, min, max, step]) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`profile-${key}`}>{label}</Label>
                        <Input
                          id={`profile-${key}`}
                          type="number"
                          min={min}
                          max={max}
                          step={step}
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
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
