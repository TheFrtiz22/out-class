"use client"

import { toast } from "sonner"
import { CalendarClock, Download, Megaphone, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ClubLogo } from "@/components/club-logo"
import { agendaDocuments, managedEvents, memberAnnouncements, type StudentMembership } from "@/lib/data"

const NAVY = "#051B3D"
const ORANGE = "#FF5900"

export function MemberPortalDialog({
  membership,
  open,
  onOpenChange,
}: {
  membership: StudentMembership | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!membership) return null

  const meetings = managedEvents.filter((e) => e.clubId === membership.clubId && e.scope === "Members Only")
  const agendas = agendaDocuments.filter((a) => a.clubId === membership.clubId)
  const announcements = memberAnnouncements.filter((a) => a.clubId === membership.clubId)

  function downloadAgenda(fileName: string) {
    toast.success("Downloading agenda", { description: fileName })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-white text-gray-900 sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ClubLogo text={membership.logoText} color={membership.color} size="lg" />
            <div className="min-w-0">
              <DialogTitle className="truncate" style={{ color: NAVY }}>
                {membership.clubName}
              </DialogTitle>
              <DialogDescription className="text-gray-500">Member Portal · My Club Hub</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
              <CalendarClock className="size-4" /> Member Meeting Schedule
            </h3>
            <div className="space-y-2">
              {meetings.map((m) => (
                <div key={m.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-sm font-medium text-gray-900">{m.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{m.recurrenceLabel ?? `${m.date} at ${m.time} — ${m.location}`}</p>
                  {m.zoomLink && (
                    <a
                      href={m.zoomLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      style={{ color: ORANGE }}
                    >
                      <Video className="size-3" /> Join Zoom
                    </a>
                  )}
                </div>
              ))}
              {meetings.length === 0 && <p className="text-sm text-gray-500">No recurring meetings scheduled yet.</p>}
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
              <Download className="size-4" /> Agenda Downloads
            </h3>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              {agendas.map((a, i) => (
                <div
                  key={a.id}
                  className={cn(
                    "flex items-center justify-between gap-3 bg-white px-3 py-2.5",
                    i !== agendas.length - 1 && "border-b border-gray-200",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-500">{a.date}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadAgenda(a.fileName)}
                    className="shrink-0 gap-1.5 text-gray-600 hover:bg-gray-100"
                  >
                    <Download className="size-3.5" /> Download
                  </Button>
                </div>
              ))}
              {agendas.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-gray-500">No agendas posted yet.</p>
              )}
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
              <Megaphone className="size-4" /> Internal Announcements
            </h3>
            <div className="space-y-2">
              {announcements.map((a) => (
                <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{a.title}</p>
                    <span className="shrink-0 text-xs text-gray-400">{a.date}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{a.body}</p>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-sm text-gray-500">No internal announcements right now.</p>}
            </div>
          </section>

          <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            This content is visible strictly to verified active members of {membership.clubName}.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
