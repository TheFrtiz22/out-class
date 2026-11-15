"use client"
import { useMemo, useState } from "react"
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type Announcements, type CollisionDetection, type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, ShieldCheck } from "@/components/icons"
import { boardColumnFor, boardColumns, boardDrop, type BoardColumn, type BoardColumnId } from "@/lib/applicant-board"
import { advanceLabel, canStage, stagedLabel, type StageRound } from "@/lib/staged-decisions"
import { formatAverage } from "@/lib/interview-review-summary"
import type { StagedDecisions } from "@/hooks/use-staged-decisions"

type BoardApp = { id: string; status: string; roundId: string; studentId: string; student: { email?: string; studentProfile?: { firstName: string; lastName: string; academicYear?: string | null } | null }; roundScore?: { average: number | null; submitted: number; required: number } | null }

/** ←/→ jump a lifted card to the neighbouring column (Space lifts and drops, Esc cancels). */
const columnKeys: KeyboardCoordinateGetter = (event, { context: { droppableRects, droppableContainers, collisionRect, over } }) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined
  event.preventDefault()
  if (!collisionRect) return undefined
  const columns = droppableContainers.getEnabled().flatMap(container => { const rect = droppableRects.get(container.id); return rect ? [{ id: container.id, rect }] : [] }).sort((a, b) => a.rect.left - b.rect.left)
  const centre = collisionRect.left + collisionRect.width / 2
  const at = over ? columns.findIndex(column => column.id === over.id) : columns.findIndex(column => column.rect.left <= centre && column.rect.left + column.rect.width >= centre)
  const target = columns[(at < 0 ? 0 : at) + (event.code === "ArrowRight" ? 1 : -1)]
  if (!target) return undefined
  return { x: target.rect.left + target.rect.width / 2 - collisionRect.width / 2, y: target.rect.top + 48 }
}
const collision: CollisionDetection = args => { const hits = pointerWithin(args); return hits.length ? hits : closestCenter(args) }

/**
 * The applicant board: columns by round and outcome, compact cards, drag (pointer, touch or keyboard) or the card
 * menu to stage Advance / Hold / Reject. Moves are staged through the shared decision hook: the card moves at once,
 * and rolls back with an error toast if the save fails. Nothing is sent until Decide › Send.
 */
export function ApplicantBoard({ applicants, rounds, counts, staged, canDecide, name, open, note }: {
  applicants: BoardApp[]; rounds: readonly StageRound[]; counts: Map<BoardColumnId, number> | null
  staged: StagedDecisions | null; canDecide: boolean; name: (app: BoardApp) => string; open: (app: BoardApp) => void; note?: string
}) {
  const columns = useMemo(() => boardColumns(rounds), [rounds])
  const [dragging, setDragging] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeys, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  )
  const byColumn = useMemo(() => {
    const map = new Map<BoardColumnId, BoardApp[]>(columns.map(column => [column.id, []]))
    for (const app of applicants) { const column = boardColumnFor(app, staged?.get(app.id)); if (column) map.get(column)?.push(app) }
    return map
  }, [applicants, columns, staged])
  const title = (id: unknown) => columns.find(column => column.id === id)?.title ?? "this column"
  const appFor = (id: unknown) => applicants.find(app => app.id === id)
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${appFor(active.id) ? name(appFor(active.id)!) : "applicant"}. Use left and right arrows to choose a column, Space to drop, Escape to cancel.`,
    onDragOver: ({ over }) => over ? `Over ${title(over.id)}.` : "Not over a column.",
    onDragEnd: ({ active, over }) => over ? `Dropped ${appFor(active.id) ? name(appFor(active.id)!) : "applicant"} in ${title(over.id)}.` : "Dropped outside the board. Nothing changed.",
    onDragCancel: () => "Move cancelled. Nothing changed.",
  }
  const draggable = (app: BoardApp) => canDecide && !!staged && canStage(app.status)

  async function drop(app: BoardApp, column: BoardColumnId) {
    if (!staged) return
    const action = boardDrop(app, column, !!staged.get(app.id))
    if (action.kind === "none") { if (action.reason) toast(action.reason); return }
    if (action.kind === "unstage") { await staged.unstage(app); return }
    await staged.stage(app, action.outcome, action.roundId)
  }
  function onDragEnd(event: DragEndEvent) {
    setDragging(null)
    const app = appFor(event.active.id)
    if (app && event.over) void drop(app, event.over.id as BoardColumnId)
  }
  const active = dragging ? appFor(dragging) : undefined

  return <DndContext sensors={sensors} collisionDetection={collision} accessibility={{ announcements, screenReaderInstructions: { draggable: "Press Enter to open this applicant. Press Space to pick up the card, then use the left and right arrows to choose a column and Space to drop it." } }}
    onDragStart={(event: DragStartEvent) => setDragging(String(event.active.id))} onDragCancel={() => setDragging(null)} onDragEnd={onDragEnd}>
    {note && <p className="text-xs text-muted-foreground">{note}</p>}
    <div className="oc-board" role="list" aria-label="Applicants by stage">
      {columns.map(column => <Column key={column.id} column={column} count={counts?.get(column.id) ?? byColumn.get(column.id)?.length ?? 0}>
        {(byColumn.get(column.id) ?? []).map(app => <Card key={app.id} app={app} rounds={rounds} staged={staged} name={name(app)} draggable={draggable(app)} canDecide={canDecide && !!staged} open={() => open(app)} />)}
      </Column>)}
    </div>
    <DragOverlay dropAnimation={null}>{active ? <CardBody app={active} rounds={rounds} staged={staged} name={name(active)} overlay /> : null}</DragOverlay>
  </DndContext>
}

function Column({ column, count, children }: { column: BoardColumn; count: number; children: React.ReactNode[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  return <section ref={setNodeRef} role="listitem" aria-label={`${column.title}, ${count}`} className="oc-board-column" data-over={isOver || undefined}>
    <header><h3 className="min-w-0 truncate">{column.title}</h3><span className="oc-board-count" aria-hidden="true">{count}</span></header>
    <ul className="oc-board-cards">{children.length ? children : <li className="oc-board-empty">{count ? "Not on this page." : "No applicants"}</li>}</ul>
  </section>
}

function Card({ app, rounds, staged, name, draggable, canDecide, open }: { app: BoardApp; rounds: readonly StageRound[]; staged: StagedDecisions | null; name: string; draggable: boolean; canDecide: boolean; open: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id, disabled: !draggable })
  const stage = (outcome: "ADVANCE" | "HOLD" | "REJECT") => void staged?.stage(app, outcome)
  const pending = staged?.get(app.id)
  // The card itself is the drag handle and opens the review (Enter / click); the decision menu sits beside it.
  return <li className="oc-board-item" data-applicant-id={app.id}>
    <div ref={setNodeRef} {...attributes} {...listeners} role="button" tabIndex={0} aria-roledescription={draggable ? "draggable applicant" : undefined}
      aria-label={`${name}${pending ? `, staged: ${stagedLabel(pending, rounds)}` : ""}. Enter opens the review.`} data-applicant-id={app.id}
      className="oc-board-card" data-dragging={isDragging || undefined} data-locked={!draggable || undefined} data-staged={!!pending || undefined} data-has-menu={canDecide && canStage(app.status) || undefined}
      title={pending ? `Staged: ${stagedLabel(pending, rounds)} · not sent yet` : undefined}
      onClick={open} onKeyDown={event => { listeners?.onKeyDown?.(event); if (event.key === "Enter" && !event.defaultPrevented) { event.preventDefault(); open() } }}>
      <CardBody app={app} rounds={rounds} staged={staged} name={name} />
    </div>
    {canDecide && canStage(app.status) && <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="oc-board-card-menu size-8" aria-label={`Decide ${name}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => stage("ADVANCE")}>{advanceLabel(app, rounds)}</DropdownMenuItem>
        {app.status !== "WAITLISTED" && <DropdownMenuItem onSelect={() => stage("HOLD")}>Hold</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => stage("REJECT")}>Reject</DropdownMenuItem>
        {pending && <DropdownMenuItem onSelect={() => void staged?.unstage(app)}>Remove staged decision</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>}
  </li>
}

function CardBody({ app, rounds, staged, name, overlay = false }: { app: BoardApp; rounds: readonly StageRound[]; staged: StagedDecisions | null; name: string; overlay?: boolean }) {
  const anonymous = app.studentId.startsWith("anonymous-")
  const pending = staged?.get(app.id)
  const round = rounds.find(item => item.id === app.roundId)?.name
  const score = app.roundScore
  const content = <>
    <Avatar aria-hidden="true"><AvatarFallback>{anonymous ? <ShieldCheck size={14} /> : name.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
    <div className="min-w-0">
      <p className="oc-board-card-name">{name}</p>
      <p className="oc-board-card-meta">
        <span>{[app.student.studentProfile?.academicYear, round].filter(Boolean).join(" · ") || "—"}</span>
        {score?.average != null && <span className="oc-score-badge" title={`Average ${formatAverage(score.average)} of 10`}>{formatAverage(score.average)}</span>}
        {score && <span className="flex-none" title={`${score.submitted} of ${score.required} reviews submitted`}>{score.submitted}/{score.required}</span>}
      </p>
      {pending && <span className="sr-only">Staged: {stagedLabel(pending, rounds)}. Sent from Decide › Send.</span>}
    </div>
  </>
  return overlay ? <div className="oc-board-card" data-overlay="true" data-staged={!!pending || undefined}>{content}</div> : content
}
