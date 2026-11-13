"use client"
import type { CSSProperties, ElementType, MouseEventHandler, ReactNode } from "react"
import Link from "next/link"
import { ArrowRight } from "@/components/icons"
import { Card } from "@/components/ui/card"
import { Panel } from "@/components/ui/panel"
import { cn } from "@/lib/utils"

/**
 * Shared dashboard pieces, taken from club home (docs/design-system.md, "Dashboards"). Every dashboard
 * is a DashboardHero, an optional NeedsYouRow, then DashboardCards in a DashboardGrid. Cards hold
 * MetricTiles, PipelineBars, DateChipList or GlassRowList. Nothing here blurs.
 */
const enter = (index?: number) => (index === undefined ? undefined : { "--i": index } as CSSProperties)

/** Ambient glow behind the page title (and the Needs you row when it is a child). */
export function DashboardHero({ children, className, ambientClassName, glow = "club" }: { children: ReactNode; className?: string; ambientClassName?: string; glow?: "club" | "neutral" | "recruiting" }) {
  return <div className={cn("oc-dashboard-hero", className)} data-glow={glow}>
    <div className={cn("oc-dashboard-ambient", ambientClassName)} aria-hidden="true" />
    {children}
  </div>
}

export function DashboardActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("oc-dashboard-actions", className)}>{children}</div>
}

/** The dashboard body: a container-query root with the glass filters switched off. */
export function Dashboard({ children, className, busy, ...props }: { children: ReactNode; className?: string; busy?: boolean } & Record<`data-${string}`, string | undefined>) {
  return <div className={cn("oc-dashboard", className)} aria-busy={busy} {...props}>{children}</div>
}

export function DashboardGrid({ main, side, className }: { main: ReactNode; side?: ReactNode; className?: string }) {
  return <div className={cn("oc-dashboard-grid", className)}>
    <div className="oc-dashboard-main">{main}</div>
    {side !== undefined && <div className="oc-dashboard-side">{side}</div>}
  </div>
}

/** "More →" link to an existing rail destination, or a button when it acts in place. */
export function DashboardMore({ href, onClick, children, className, prefetch }: { href?: string; onClick?: MouseEventHandler<HTMLElement>; children: ReactNode; className?: string; prefetch?: boolean }) {
  const content = <>{children} <ArrowRight aria-hidden="true" size={14} /></>
  return href
    ? <Link className={cn("oc-dashboard-more", className)} href={href} onClick={onClick} prefetch={prefetch}>{content}</Link>
    : <button type="button" className={cn("oc-dashboard-more", className)} onClick={onClick}>{content}</button>
}

/** Glass card with a head (title, aside or more link), body and optional foot. The more link sits in the
 * head unless the head carries an aside, or `moreAt="foot"`. */
export function DashboardCard({ id, title, label, aside, more, moreAt, foot, index, className, children, headingTabIndex }: {
  /** `label` names the region when it must differ from the visible title (an existing accessible name). */
  id: string; title: ReactNode; label?: string; aside?: ReactNode; more?: { href?: string; onClick?: MouseEventHandler<HTMLElement>; label: string; prefetch?: boolean }; moreAt?: "head" | "foot"; foot?: ReactNode
  index?: number; className?: string; children?: ReactNode; headingTabIndex?: number
}) {
  const atFoot = moreAt === "foot" || (moreAt === undefined && aside !== undefined)
  const link = more && <DashboardMore href={more.href} onClick={more.onClick} prefetch={more.prefetch}>{more.label}</DashboardMore>
  return <Panel as="section" variant="glass" className={cn("oc-dashboard-card", className)} style={enter(index)} aria-labelledby={label ? undefined : id} aria-label={label}>
    <header className="oc-dashboard-card-head">
      <h2 id={id} tabIndex={headingTabIndex}>{title}</h2>
      {!atFoot ? link : typeof aside === "string" ? <span>{aside}</span> : aside}
    </header>
    {children}
    {foot}
    {atFoot && link}
  </Panel>
}

export function DashboardQuiet({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("oc-dashboard-quiet", className)}>{children}</p>
}

export function DashboardFoot({ children }: { children: ReactNode }) {
  return <p className="oc-dashboard-foot">{children}</p>
}

export type NeedsItem = { id: string; title: ReactNode; detail?: ReactNode; progress?: { done: number; total: number; label?: string }; action: ReactNode }

/** The attention row: one navy priority card, then light glass cards; a quiet strip when clear. */
export function NeedsYouRow({ items, clear, heading = "Needs you", headingId = "dashboard-needs", className }: { items: NeedsItem[]; clear: ReactNode; heading?: string; headingId?: string; className?: string }) {
  const [first, ...rest] = items
  const body = (item: NeedsItem, priority: boolean) => <>
    <p className="oc-needs-title">{priority && <span className="oc-needs-dot" aria-hidden="true" />}{item.title}</p>
    {item.detail && <p className="oc-needs-detail">{item.detail}</p>}
    {item.progress && item.progress.total > 0 && <div className="oc-needs-progress"><span className="oc-needs-progress-track" aria-hidden="true"><span style={{ "--value": `${Math.round(item.progress.done / item.progress.total * 100)}%` } as CSSProperties} /></span><span>{item.progress.label ?? `${item.progress.done} of ${item.progress.total} reviewed`}</span></div>}
    {item.action}
  </>
  return <section className={cn("oc-dashboard-needs", className)} aria-labelledby={headingId}>
    <div className="oc-dashboard-section-head"><h2 id={headingId}>{heading}</h2></div>
    {first ? <div className="oc-needs-grid" data-count={items.length}>
      <Card variant="glass-navy" className="oc-needs-card" data-needs={first.id} data-urgent="true" style={enter(0)}>{body(first, true)}</Card>
      {rest.length > 0 && <ul className="oc-needs-rest">{rest.map((item, index) => <li key={item.id}><Card variant="glass-raised" className="oc-needs-card" data-needs={item.id} style={enter(index + 1)}>{body(item, false)}</Card></li>)}</ul>}
    </div> : <Card variant="glass" className="oc-needs-clear" style={enter(0)}><p>{clear}</p></Card>}
  </section>
}

/** The action that makes a whole needs card clickable: a link or an in-place button. */
export function NeedsAction({ href, onClick, children, prefetch }: { href?: string; onClick?: MouseEventHandler<HTMLElement>; children: ReactNode; prefetch?: boolean }) {
  const content = <>{children} <ArrowRight aria-hidden="true" size={14} /></>
  return href ? <Link className="oc-needs-action" href={href} onClick={onClick} prefetch={prefetch}>{content}</Link> : <button type="button" className="oc-needs-action" onClick={onClick}>{content}</button>
}

export type MetricTile = { label: ReactNode; value: ReactNode; of?: ReactNode; urgent?: boolean; key?: string }
/** Big serif numbers; every value is text. */
export function MetricTiles({ items, label, size = "default", className }: { items: MetricTile[]; label?: string; size?: "default" | "large"; className?: string }) {
  return <dl className={cn("oc-metric-tiles", className)} data-size={size} aria-label={label}>
    {items.map((item, i) => <div key={item.key ?? (typeof item.label === "string" ? item.label : i)}><dt>{item.label}</dt><dd className="oc-dashboard-number" data-urgent={item.urgent || undefined}>{item.value}{item.of !== undefined && <small> / {item.of}</small>}</dd></div>)}
  </dl>
}

export type PipelineStage = { id: string; label: string; count: number; tone?: string }
/** Stage counts with decorative bars; on phones `compact` shows one segmented bar for `compactStages`. */
export function PipelineBars({ stages, compactStages, className }: { stages: PipelineStage[]; compactStages?: PipelineStage[]; className?: string }) {
  const max = Math.max(1, ...stages.map(s => s.count))
  const mobileTotal = compactStages ? Math.max(1, compactStages.reduce((n, s) => n + s.count, 0)) : 1
  return <div className={cn("oc-pipeline-bars", className)} data-compact={compactStages ? "true" : undefined}>
    <ol className="oc-pipeline-stages" style={{ "--stages": Math.min(4, stages.length) } as CSSProperties}>{stages.map(stage => <li key={stage.id} data-tone={stage.tone}>
      <span className="oc-pipeline-stage-label">{stage.label}</span>
      <strong className="oc-dashboard-number">{stage.count}</strong>
      <span className="oc-pipeline-track" aria-hidden="true"><span style={{ "--value": `${Math.round(stage.count / max * 100)}%` } as CSSProperties} /></span>
    </li>)}</ol>
    {compactStages && <>
      <div className="oc-pipeline-compact" aria-hidden="true">
        <span className="oc-pipeline-compact-bar">{compactStages.map(stage => <span key={stage.id} data-tone={stage.tone} style={{ "--value": `${stage.count / mobileTotal * 100}%` } as CSSProperties} />)}</span>
      </div>
      <ul className="oc-pipeline-compact-counts" style={{ "--compact-stages": compactStages.length } as CSSProperties}>{compactStages.map(stage => <li key={stage.id} data-tone={stage.tone}><strong className="oc-dashboard-number">{stage.count}</strong><span>{stage.label}</span></li>)}</ul>
    </>}
  </div>
}

/** One row: a whole-surface button or link, or static text. `lead` is a time, chip, dot or avatar. */
/** `action` keeps a separate control (a link or button with its own name) at the end of a static row. */
export function GlassRow({ lead, title, note, detail, trailing, action, onClick, href, className, ...data }: {
  lead?: ReactNode; title: ReactNode; note?: ReactNode; detail?: ReactNode; trailing?: ReactNode; action?: ReactNode; onClick?: () => void; href?: string; className?: string
} & Record<`data-${string}`, string | undefined>) {
  const inner = <>{lead}<span className="oc-dashboard-row-copy"><strong>{title}</strong>{note && <span className="oc-dashboard-row-note">{note}</span>}{detail && <small>{detail}</small>}</span>{(onClick || href) && (trailing ?? <ArrowRight aria-hidden="true" size={14} />)}</>
  const common = { className: cn("oc-dashboard-row", className), "data-lead": lead ? undefined : "none", ...data }
  if (href) return <Link {...common} href={href}>{inner}</Link>
  if (onClick) return <button type="button" {...common} onClick={onClick}>{inner}</button>
  return <div {...common} data-static="true" data-action={action ? "true" : undefined}>{inner}{action}</div>
}

export function GlassRowList({ children, className, as: Tag = "ul" }: { children: ReactNode; className?: string; as?: ElementType }) {
  return <Tag className={cn("oc-dashboard-rows", className)}>{children}</Tag>
}

/** Month and day chip; navy for meetings, interview and deadline tints by kind. Decorative: the row says the date. */
export function DateChip({ at, kind, timeZone }: { at: Date; kind?: string; timeZone?: string }) {
  return <span className="oc-date-chip" data-kind={kind} aria-hidden="true"><span>{at.toLocaleDateString("en-US", { month: "short", timeZone })}</span><strong>{timeZone ? at.toLocaleDateString("en-US", { day: "numeric", timeZone }) : at.getDate()}</strong></span>
}

export type DateChipItem = { id: string; at: Date; kind?: string; title: ReactNode; detail?: ReactNode; onClick?: () => void; href?: string }
/** `timeZone` keeps the chip on the zone the row text uses (for example the Eastern scheduling zone). */
export function DateChipList({ items, empty, when, timeZone }: { items: DateChipItem[]; empty: ReactNode; when: (at: Date) => string; timeZone?: string }) {
  if (!items.length) return typeof empty === "string" ? <DashboardQuiet>{empty}</DashboardQuiet> : <>{empty}</>
  return <GlassRowList>{items.map(item => <li key={item.id}>
    <GlassRow lead={<DateChip at={item.at} kind={item.kind} timeZone={timeZone} />} title={item.title} onClick={item.onClick} href={item.href}
      detail={<><time dateTime={item.at.toISOString()}>{when(item.at)}</time>{item.detail ? <> · {item.detail}</> : null}</>} />
  </li>)}</GlassRowList>
}
