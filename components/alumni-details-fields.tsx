"use client"
import { useEffect, useId, useRef } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { POST_GRAD_TEXT_MAX } from "@/lib/graduation"

export type AlumniDetailsDraft = { employer: string; role: string; showInAlumniList: boolean; shareEmployer: boolean }
export const emptyAlumniDetails: AlumniDetailsDraft = { employer: "", role: "", showInAlumniList: true, shareEmployer: true }
export const alumniDetailsDraft = (p: { postGradEmployer?: string | null; postGradRole?: string | null; alumniDirectoryVisible?: boolean | null; alumniPlacementShare?: boolean | null } | null | undefined): AlumniDetailsDraft =>
  ({ employer: p?.postGradEmployer ?? "", role: p?.postGradRole ?? "", showInAlumniList: p?.alumniDirectoryVisible ?? true, shareEmployer: p?.alumniPlacementShare ?? true })
/** What the server action receives (lib/graduation.ts postGradDetailsSchema validates it). */
export const alumniDetailsInput = (d: AlumniDetailsDraft) => ({ employer: d.employer.trim() || null, role: d.role.trim() || null, showInAlumniList: d.showInAlumniList, shareEmployer: d.shareEmployer })

/** "Where are you going to work?" plus the two alumni privacy choices. Used by the Home prompt and Profile. */
export function AlumniDetailsFields({ value, onChange, disabled, focusOnMount }: { value: AlumniDetailsDraft; onChange: (next: AlumniDetailsDraft) => void; disabled?: boolean; focusOnMount?: boolean }) {
  const id = useId()
  // The step replaces the button that opened it, so focus moves to its first field instead of the page.
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => { if (focusOnMount) first.current?.focus() }, [focusOnMount])
  const set = (patch: Partial<AlumniDetailsDraft>) => onChange({ ...value, ...patch })
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor={`${id}-employer`}>Employer <span className="text-muted-foreground">(optional)</span></Label>
        <Input id={`${id}-employer`} value={value.employer} maxLength={POST_GRAD_TEXT_MAX} autoComplete="organization" ref={first} disabled={disabled} onChange={e => set({ employer: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-role`}>Role or title <span className="text-muted-foreground">(optional)</span></Label>
        <Input id={`${id}-role`} value={value.role} maxLength={POST_GRAD_TEXT_MAX} autoComplete="organization-title" disabled={disabled} onChange={e => set({ role: e.target.value })} /></div>
    </div>
    <label className="flex min-h-11 items-start gap-3 text-sm"><Checkbox className="mt-0.5" checked={value.shareEmployer} disabled={disabled} onCheckedChange={v => set({ shareEmployer: v === true })} />
      <span>Add the company name (not your name) to my clubs’ “Where members go” list</span></label>
    <label className="flex min-h-11 items-start gap-3 text-sm"><Checkbox className="mt-0.5" checked={value.showInAlumniList} disabled={disabled} onCheckedChange={v => set({ showInAlumniList: v === true })} />
      <span>Show me in my clubs’ alumni list <span className="block text-xs text-muted-foreground">Current members see your name, email, employer, role and class year.</span></span></label>
  </div>
}
