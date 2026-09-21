"use client"

import { useState } from "react"
import { MoreHorizontal, Mail, UserRound, XCircle, ChevronRight, ChevronLeft, GripVertical } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Applicant } from "@/lib/data"

type ColumnStatus = Applicant["status"]

interface PipelineViewProps {
  columns: { id: string; title: string; subtitle?: string }[]
  applicants: Applicant[]
  getScore: (id: string, fallback: number) => number
  onMove: (id: string, status: ColumnStatus) => void
  onViewProfile: (id: string) => void
  onReject: (id: string) => void
  onSendEmail: (name: string) => void
}

export function PipelineView({ columns, applicants, getScore, onMove, onViewProfile, onReject, onSendEmail }: PipelineViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ColumnStatus | null>(null)
  const [rejectedExpanded, setRejectedExpanded] = useState(false)

  function candidatesFor(status: ColumnStatus) {
    return applicants.filter((a) => a.status === status)
  }

  function handleDrop(status: ColumnStatus) {
    if (draggedId) onMove(draggedId, status)
    setDraggedId(null)
    setDragOverColumn(null)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((column) => {
        const items = candidatesFor(column.id)
        const isRejected = column.id === "Rejected"
        const collapsed = isRejected && !rejectedExpanded

        if (collapsed) {
          return (
            <button
              key={column.id}
              data-stage-column={column.id}
              type="button"
              onClick={() => setRejectedExpanded(true)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverColumn(column.id)
              }}
              onDrop={() => handleDrop(column.id)}
              className={cn(
                "flex w-14 shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white py-4 text-gray-400 transition-colors hover:bg-neutral-50",
                dragOverColumn === column.id && "border-foreground bg-muted text-muted-foreground",
              )}
              aria-label="Expand Rejected column"
            >
              <ChevronLeft className="size-3.5" />
              <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                {items.length}
              </span>
              <span className="text-[10px] font-medium tracking-wide" style={{ writingMode: "vertical-rl" }}>
                Rejected
              </span>
            </button>
          )
        }

        return (
          <div
            key={column.id}
            data-stage-column={column.id}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverColumn(column.id)
            }}
            onDragLeave={() => setDragOverColumn((c) => (c === column.id ? null : c))}
            onDrop={() => handleDrop(column.id)}
            className={cn(
              "flex min-w-64 flex-1 flex-col rounded-xl border bg-white transition-colors",
              isRejected ? "border-neutral-200 opacity-80" : "border-neutral-200",
              dragOverColumn === column.id && "border-foreground bg-muted",
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 pt-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn("truncate text-sm font-semibold", isRejected ? "text-gray-500" : "text-foreground")}>
                    {column.title}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      isRejected ? "bg-gray-200 text-gray-500" : "bg-foreground/10 text-foreground",
                    )}
                  >
                    {items.length}
                  </span>
                </div>
                {column.subtitle && (
                  <p className={cn("truncate text-[11px]", isRejected ? "text-gray-400" : "text-muted-foreground")}>
                    {column.subtitle}
                  </p>
                )}
              </div>
              {isRejected && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-gray-400 hover:text-gray-600"
                  onClick={() => setRejectedExpanded(false)}
                  aria-label="Collapse Rejected column"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {items.map((a) => {
                const score = getScore(a.id, a.score)
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(event) => { event.dataTransfer.setData("text/plain", a.id); event.dataTransfer.effectAllowed = "move"; setDraggedId(a.id) }}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => onViewProfile(a.id)}
                    className={cn(
                      "group relative cursor-grab rounded-xl border border-neutral-200 bg-white p-2.5 shadow-none transition-colors hover:shadow-none active:cursor-grabbing",
                      draggedId === a.id && "opacity-40",
                      isRejected && "grayscale",
                    )}
                  >
                    <button type="button" aria-label={`Drag ${a.name}`} className="mb-1 flex touch-none items-center gap-1 rounded px-1 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-50"
                      onClick={event => event.stopPropagation()}
                      onPointerDown={event => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDraggedId(a.id) }}
                      onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-stage-column]"); setDragOverColumn(target?.dataset.stageColumn ?? null) }}
                      onPointerUp={event => {
                        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-stage-column]")?.dataset.stageColumn
                        event.currentTarget.releasePointerCapture(event.pointerId)
                        if (target && columns.some(column => column.id === target)) onMove(a.id, target)
                        setDraggedId(null); setDragOverColumn(null)
                      }}
                      onPointerCancel={() => { setDraggedId(null); setDragOverColumn(null) }}
                    ><GripVertical className="size-3" />Drag to move</button>
                    <div className="flex items-start gap-2 pr-5">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-[10px] font-medium",
                            isRejected ? "bg-gray-100 text-gray-400" : "bg-foreground/10 text-foreground",
                          )}
                        >
                          {a.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-xs font-semibold", isRejected ? "text-gray-500" : "text-foreground")}>
                          {a.name}
                        </p>
                        <p className={cn("truncate text-[11px]", isRejected ? "text-gray-400" : "text-muted-foreground")}>
                          {a.major}
                        </p>
                        {score > 0 && (
                          <span
                            className={cn(
                              "mt-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              isRejected ? "bg-gray-100 text-gray-400" : "bg-secondary text-muted-foreground",
                            )}
                          >
                            {score.toFixed(1)}/5.0
                          </span>
                        )}
                      </div>
                    </div>

                    <select aria-label={`Recruitment stage for ${a.name}`} value={a.status} onClick={event => event.stopPropagation()} onChange={event => onMove(a.id, event.target.value)} className="mt-3 w-full rounded-md border border-neutral-200 bg-white p-1.5 text-xs">
                      {columns.map(stage => <option key={stage.id} value={stage.id}>{stage.title}</option>)}
                    </select>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded text-gray-400 opacity-0 transition-opacity hover:bg-neutral-50 hover:text-gray-600 group-hover:opacity-100 focus-visible:opacity-100"
                          aria-label={`Actions for ${a.name}`}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl border-neutral-200 bg-white shadow-none" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => onSendEmail(a.name)}>
                          <Mail className="size-3.5" /> Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onViewProfile(a.id)}>
                          <UserRound className="size-3.5" /> View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => onReject(a.id)}>
                          <XCircle className="size-3.5" /> Reject
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}

              {items.length === 0 && (
                <p className="py-6 text-center text-[11px] text-muted-foreground">No candidates here.</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
