"use client"

import { useEffect, useRef, useState } from "react"
import { useDemoMode } from "@/contexts/demo-context"
import { publishClubAnnouncement } from "@/actions/communications"
import { getRecipientGroups, previewRecipientAudience } from "@/actions/recipient-groups"
import { AudienceEditor, AudiencePreview } from "@/components/recipient-audiences"
import { recipientAudienceSchema } from "@/lib/recipient-audience"
import { ActionWorkflow } from "@/components/product/action-workflow"
import { Button } from "@/components/ui/button"
import { meetingDate } from "@/lib/meeting-presentation"

type Meeting = { id: string; clubId: string; title: string; date: Date | string; location: string }
export function MeetingGroupInvitation({ meeting }: { meeting: Meeting }) {
  const demo = useDemoMode()
  return <ActionWorkflow title="Invite people" description="Choose a group and send a meeting announcement." trigger="Invite people" presentation="sheet">
    {done => demo.isDemoEnabled ? <p className="text-sm">Meeting invitations are available in your live club workspace.</p> : <InvitationComposer key={meeting.id} meeting={meeting} done={done} />}
  </ActionWorkflow>
}
function InvitationComposer({ meeting, done }: { meeting: Meeting; done: () => void }) {
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getRecipientGroups>> | null>(null)
  const [audience, setAudience] = useState(() => recipientAudienceSchema.parse({ include: [{ source: "MEMBERS" }] }))
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewRecipientAudience>> | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  const requestKey = useRef<string | null>(null), working = useRef(false)
  useEffect(() => {
    let current = true
    getRecipientGroups(meeting.clubId).then(value => { if (current) setCatalog(value) }).catch(() => { if (current) setError("Could not load groups. Close and reopen to try again.") })
    return () => { current = false }
  }, [meeting.clubId])
  async function work(send: boolean) {
    if (working.current) return
    working.current = true; setBusy(true); setError("")
    try {
      if (!send) setPreview(await previewRecipientAudience(meeting.clubId, audience))
      else {
        requestKey.current ??= crypto.randomUUID()
        await publishClubAnnouncement({ clubId: meeting.clubId, title: `Meeting: ${meeting.title}`.slice(0, 200), body: `${meetingDate(meeting.date)} · ${meeting.location}\n\nJoin us for ${meeting.title}.\n${window.location.origin}/meetings/${meeting.id}`, audience: "CUSTOM", audienceSpec: audience, requestKey: requestKey.current })
        done()
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send the meeting announcement. Try again.") }
    finally { working.current = false; setBusy(false) }
  }
  return <div className="space-y-5" data-saving={busy}>
    <section className="rounded-lg bg-secondary p-4"><h3 className="font-medium">{meeting.title}</h3><p className="mt-2 text-sm">{meetingDate(meeting.date)} · {meeting.location}</p></section>
    <AudienceEditor value={audience} catalog={catalog} disabled={busy || !catalog} onChange={value => { setAudience(value); setPreview(null); requestKey.current = null }} />
    <Button type="button" variant="outline" disabled={busy || !catalog} onClick={() => void work(false)}>Preview recipients</Button>
    <AudiencePreview preview={preview} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">Sends a club announcement with the meeting details and link. Each person’s notification preferences apply.</p>
    <Button type="button" disabled={busy || !preview?.count} onClick={() => void work(true)}>{busy ? "Working…" : `Send meeting announcement${preview ? ` · ${preview.count}` : ""}`}</Button>
  </div>
}
