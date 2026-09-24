"use client"
import { useState } from "react"
import {
  getClubAccess,
  inviteClubManager,
  updateClubAccess,
  revokeClubInvitation,
} from "@/actions/club-access"
import { clubPermissions, permissionTemplates, permissionLabels } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
export function ClubAccessEditor({
  clubId,
  initial,
}: {
  clubId: string
  initial: Awaited<ReturnType<typeof getClubAccess>>
}) {
  const [data, setData] = useState(initial),
    [email, setEmail] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [memberId, setMemberId] = useState(""),
    [owner, setOwner] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("")
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setMessage("")
    try {
      await action()
      setData(await getClubAccess(clubId))
      setMessage("Access updated.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-6">
      <p>
        Capabilities apply only to this club. Owners retain every capability. Only owners can
        appoint or change other owners. Anonymous reviewers need only “Review applications”. Identified review, identity reveals, moving applicants, and recording decisions require “View identified applicants”.
      </p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block">
          Person
          <select
            className="mt-2 block w-full rounded border p-3"
            value={memberId}
            onChange={(e) => {
              const member = data.members.find((m) => m.id === e.target.value)
              setMemberId(e.target.value)
              setSelected(member?.permissions || [])
              setOwner(member?.isOwner || false)
            }}
          >
            <option value="">Invite another UVA account</option>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.email}
                {m.isOwner ? " · Owner" : ""}
              </option>
            ))}
          </select>
        </label>
        {!memberId && (
          <label className="block">
            UVA email
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
        <label className="block">
          Start with a template
          <select
            className="ml-3 rounded border p-2"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value)
                setSelected([
                  ...permissionTemplates[e.target.value as keyof typeof permissionTemplates],
                ])
            }}
          >
            <option value="">Custom capabilities</option>
            {Object.keys(permissionTemplates).map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {clubPermissions.map((p) => (
            <label key={p} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={selected.includes(p)}
                onChange={(e) =>
                  setSelected(e.target.checked ? [...selected, p] : selected.filter((v) => v !== p))
                }
              />
              {permissionLabels[p]}
            </label>
          ))}
        </div>
        {memberId && (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={owner} onChange={(e) => setOwner(e.target.checked)} />
            Club owner
          </label>
        )}
        <Button
          onClick={() =>
            void run(async () => {
              if (memberId)
                await updateClubAccess({ clubId, memberId, permissions: selected, isOwner: owner })
              else
                await inviteClubManager({
                  clubId,
                  email,
                  permissions: selected as (typeof clubPermissions)[number][],
                })
            })
          }
        >
          {memberId ? "Save access" : "Create invitation"}
        </Button>
        {memberId && <Button variant="outline" onClick={() => void run(() => updateClubAccess({ clubId, memberId, permissions: [], isOwner: false }))}>Revoke management access</Button>}
      </fieldset>
      <p role="status">{message}</p>
      <h2 className="text-lg font-semibold">Pending invitations</h2>
      <p className="text-sm text-muted-foreground">
        Copy and share the invitation link. Email delivery is not configured by this feature.
      </p>
      {data.invitations.map((i) => (
        <div key={i.id} className="flex flex-wrap items-center gap-3 border-b py-3">
          <span>{i.email}</span>
          <a className="underline" href={`/invitations/${i.id}`}>
            Invitation link
          </a>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => revokeClubInvitation(clubId, i.id))}
          >
            Revoke
          </Button>
        </div>
      ))}
    </div>
  )
}
