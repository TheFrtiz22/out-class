"use client"
import { MeetingList } from "@/components/meeting-workspace"
import { ClubInterviewKitSettings } from "@/components/interview-kit-editor"
import { ClubManagerView } from "@/components/views/club-manager-view"
import { useEffect, useState } from "react"
import { getClubMembers, addClubMember, removeClubMember } from "@/actions/club-access"
import { useAuth } from "@/contexts/auth-context"
import { hasPermission } from "@/lib/permissions"
import { updateClubSettings, getClubTasks, saveClubTask } from "@/actions/club-workspace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
export function ClubWorkspaceSettings() {
  const { user, activeClubId, refreshUser } = useAuth()
  const member = user?.memberships.find((m) => m.clubId === activeClubId)
  const [members, setMembers] = useState<Awaited<ReturnType<typeof getClubMembers>>>([])
  useEffect(() => {
    let current = true
    setMembers([])
    if (hasPermission(member, "members.manage"))
      void getClubMembers(activeClubId)
        .then((data) => {
          if (current) setMembers(data)
        })
        .catch(() => {
          if (current) setMessage("Could not load members.")
        })
    return () => {
      current = false
    }
  }, [activeClubId, member?.permissions])
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [tasks, setTasks] = useState<Awaited<ReturnType<typeof getClubTasks>>>([])
  useEffect(() => {
    let current = true
    setTasks([])
    if (hasPermission(member, "tasks.manage"))
      void getClubTasks(activeClubId)
        .then((data) => {
          if (current) setTasks(data)
        })
        .catch(() => {
          if (current) setMessage("Could not load tasks.")
        })
    return () => {
      current = false
    }
  }, [activeClubId, member?.permissions])
  if (!member) return <p>No club workspace assigned.</p>
  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setMessage("")
    try {
      await fn()
      await refreshUser()
      setMessage("Saved.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="max-w-3xl space-y-8" key={member.id}>
      {hasPermission(member, "interviews.manage") && <ClubInterviewKitSettings clubId={activeClubId} />}
      <h1 className="font-display text-3xl">{member.club.name}</h1>
      <MeetingList key={activeClubId} clubId={activeClubId} />
      {hasPermission(member, "leaders.manage") && (
        <a className="inline-block underline" href={`/club-access/${member.clubId}`}>
          Manage workspace access and invitations
        </a>
      )}
      {hasPermission(member, "club.settings") && (
        <form
          className="space-y-4"
          key={member.id}
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            void run(() =>
              updateClubSettings({
                clubId: member.clubId,
                name: String(data.get("name")),
                tagline: String(data.get("tagline")),
                description: String(data.get("description")),
              }),
            )
          }}
        >
          <label className="block">
            Club name
            <Input name="name" defaultValue={member.club.name} required />
          </label>
          <label className="block">
            Tagline
            <Input name="tagline" defaultValue={member.club.tagline} />
          </label>
          <label className="block">
            Description
            <textarea
              className="mt-2 min-h-32 w-full rounded border p-3"
              name="description"
              defaultValue={member.club.description}
            />
          </label>
          <Button disabled={busy}>Save club profile</Button>
        </form>
      )}
      {hasPermission(member, "tasks.manage") && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const title = String(new FormData(e.currentTarget).get("title"))
              void run(async () => {
                await saveClubTask({ clubId: member.clubId, title, status: "OPEN" })
                setTasks(await getClubTasks(member.clubId))
              })
            }}
          >
            <Input aria-label="New task" name="title" required />
            <Button disabled={busy}>Add task</Button>
          </form>
          {tasks.map((task) => (
            <div className="flex items-center justify-between gap-3 border-b py-3" key={task.id}>
              <span>{task.title}</span>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await saveClubTask({
                      ...task,
                      status: task.status === "DONE" ? "OPEN" : "DONE",
                    })
                    setTasks(await getClubTasks(member.clubId))
                  })
                }
              >
                {task.status === "DONE" ? "Reopen" : "Complete"}
              </Button>
            </div>
          ))}
        </section>
      )}
      {hasPermission(member, "members.manage") && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Members</h2>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const email = String(new FormData(e.currentTarget).get("email"))
              void run(async () => {
                await addClubMember(member.clubId, email)
                setMembers(await getClubMembers(member.clubId))
              })
            }}
          >
            <Input name="email" type="email" aria-label="Existing member UVA email" required />
            <Button disabled={busy}>Add member</Button>
          </form>
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap justify-between gap-3 border-b py-3">
              <span>
                {m.user.email}
                {m.isOwner ? " · Owner" : ""}
              </span>
              {!m.isOwner && !m.permissions.length && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await removeClubMember(member.clubId, m.id)
                      setMembers(await getClubMembers(member.clubId))
                    })
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
      <details className="border-t pt-5">
        <summary className="cursor-pointer text-sm">Existing local preview tools</summary>
        <p className="my-4 text-sm text-muted-foreground">
          These existing builders use browser-only sample state. They do not publish club changes,
          invitations, or permissions. Workspace permissions are managed above.
        </p>
        <ClubManagerView />
      </details>
      <p role="status">{message}</p>
    </div>
  )
}
