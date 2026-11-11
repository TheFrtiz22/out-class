"use client"
import type { ComponentProps, MouseEvent, ReactNode } from "react"
import { ArrowDown, ArrowUp } from "@/components/icons"
import { Table } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/**
 * The card around a hand-built Table (horizontal scroll, token borders and header styles).
 * `caption` names the table for assistive technology. Lists of records use `DataTable` below.
 */
export function DataTableFrame({ caption, captionVisible = false, className, tableClassName, children, ...props }: Omit<ComponentProps<"table">, "className"> & { caption: ReactNode; captionVisible?: boolean; className?: string; tableClassName?: string }) {
  return <div data-slot="data-table" className={cn("oc-data-surface", className)}>
    <Table className={tableClassName} {...props}>
      <caption className={captionVisible ? "oc-data-table-caption" : "sr-only"}>{caption}</caption>
      {children}
    </Table>
  </div>
}

/**
 * Widths of the list's own content area (container queries, not the viewport), shared by every list:
 * below 640px the list is compact cards; from 640px it is a table whose low-priority columns appear at
 * `md` 760px, `lg` 880px and `xl` 1040px. Use the same names on every page.
 */
export type DataTableWidth = "md" | "lg" | "xl"

export type DataTableColumn<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Makes the header a sort button for this key. */
  sortKey?: string
  /** The record's name: sticky, and the keyboard target that opens the record. Exactly one column. */
  primary?: boolean
  /** Primary column only: muted text after the name (a DataTableSecondary). It sits beside the open button, not
   * inside it, so the button's visible text stays the name its accessible label already contains. */
  secondary?: (row: T) => ReactNode
  /** Shown only when the list is at least this wide. */
  showFrom?: DataTableWidth
  /** Hidden once the list is at least this wide (a combined column that wider lists split up). */
  hideFrom?: DataTableWidth
  align?: "start" | "end"
  className?: string
}

export type DataTableSelection<T> = {
  label: string
  isSelected: (row: T) => boolean
  toggle: (row: T) => void
  disabled?: (row: T) => boolean
  rowLabel: (row: T) => string
  /** Optional header control (for example "select all"); otherwise the header names the column for screen readers. */
  header?: ReactNode
}

export type DataTableCard<T> = {
  title: (row: T) => ReactNode
  /** One muted line (joined facts). No field labels. */
  meta?: (row: T) => ReactNode
  /** A one-line truncated preview between the title and the meta line. */
  preview?: (row: T) => ReactNode
  /** Right-aligned on the first line (a status pill). */
  trailing?: (row: T) => ReactNode
  /** Controls that stay usable on the card (an actions menu); they sit above the card's open target. */
  actions?: (row: T) => ReactNode
}

export type DataTableProps<T> = {
  caption: string
  rows: readonly T[]
  rowKey: (row: T) => string
  columns: DataTableColumn<T>[]
  card: DataTableCard<T>
  /** Opens the record. `origin` is the row's open control, for returning focus when a drawer closes. */
  onOpen?: (row: T, origin: HTMLElement | null) => void
  /** Rows that have no record to open (pending invitations) render their name as plain text. */
  isOpenable?: (row: T) => boolean
  /** Accessible name of the open control, e.g. "Open Amara Avery". Defaults to the visible text. */
  openLabel?: (row: T) => string
  /** Extra attributes for the open control (focus restoration looks these up). */
  openAttributes?: (row: T) => Record<`data-${string}`, string>
  selection?: DataTableSelection<T>
  sort?: { key: string; descending: boolean; toggle: (key: string) => void }
  density?: "default" | "compact"
  disabled?: boolean
  className?: string
  /** Marks rows (for example the selected or open record). */
  rowState?: (row: T) => string | undefined
}

const widthClass = (column: Pick<DataTableColumn<unknown>, "showFrom" | "hideFrom">) =>
  cn(column.showFrom && `oc-dt-from-${column.showFrom}`, column.hideFrom && `oc-dt-until-${column.hideFrom}`)

/** Clicks on these inside a row keep their own behavior instead of opening the record. */
const INTERACTIVE = "a, button, input, label, select, textarea, summary, [role='menuitem'], [data-dt-stop]"

function ignoreRowClick(event: MouseEvent) {
  const target = event.target as Element | null
  if (!target || target.closest(INTERACTIVE)) return true
  const selected = typeof window !== "undefined" ? window.getSelection?.()?.toString() : ""
  return !!selected
}

/**
 * One list for every workspace page. A table while there is room (sortable headers with aria-sort,
 * one-line ~44px rows, the selection checkbox first, the name column sticky while the table scrolls
 * sideways inside its card) and two-line cards below 640px. The whole row or card opens the record;
 * the name is the keyboard target. Layout follows the width of the list, never the viewport.
 */
export function DataTable<T>({ caption, rows, rowKey, columns, card, onOpen, isOpenable, openLabel, openAttributes, selection, sort, density = "default", disabled = false, className, rowState }: DataTableProps<T>) {
  const primary = columns.find(column => column.primary) ?? columns[0]
  const openable = (row: T) => !!onOpen && (isOpenable?.(row) ?? true)
  const open = (row: T, origin: HTMLElement | null) => { if (!disabled && openable(row)) onOpen?.(row, origin) }
  const openControl = (row: T, children: ReactNode, cardControl = false) => openable(row)
    ? <button type="button" className={cardControl ? "oc-dt-card-open" : "oc-dt-open"} disabled={disabled} aria-label={openLabel?.(row)} {...openAttributes?.(row)} onClick={event => { event.stopPropagation(); open(row, event.currentTarget) }}>{children}</button>
    : <span className={cardControl ? "oc-dt-card-open" : "oc-dt-open"}>{children}</span>
  const checkbox = (row: T) => selection && <label className="oc-dt-check"><input type="checkbox" className="oc-checkbox" aria-label={selection.rowLabel(row)} checked={selection.isSelected(row)} disabled={disabled || selection.disabled?.(row)} onChange={() => selection.toggle(row)} /></label>
  return <div data-slot="data-table" data-density={density} className={cn("oc-dt", className)} aria-busy={disabled || undefined}>
    <div className="oc-dt-table oc-data-surface">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead><tr>
          {selection && <th scope="col" className="oc-dt-select">{selection.header ?? <span className="sr-only">{selection.label}</span>}</th>}
          {columns.map(column => {
            const active = !!column.sortKey && sort?.key === column.sortKey
            return <th key={column.id} scope="col" data-align={column.align} data-primary={column.primary || undefined}
              aria-sort={column.sortKey && sort ? active ? sort.descending ? "descending" : "ascending" : "none" : undefined}
              className={cn(widthClass(column), column.className) || undefined}>
              {column.sortKey && sort ? <button type="button" className="oc-dt-sort" onClick={() => sort.toggle(column.sortKey!)}
                aria-label={`Sort by ${typeof column.header === "string" ? column.header : column.id}${active ? sort.descending ? ", currently descending" : ", currently ascending" : ""}`}>
                {column.header}{active && sort.descending ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" data-inactive={!active || undefined} />}
              </button> : column.header}
            </th>
          })}
        </tr></thead>
        <tbody>{rows.map(row => <tr key={rowKey(row)} data-state={rowState?.(row)} data-openable={openable(row) ? "" : undefined}
          onClick={openable(row) ? event => { if (!ignoreRowClick(event)) open(row, event.currentTarget.querySelector<HTMLElement>(".oc-dt-open")) } : undefined}>
          {selection && <td className="oc-dt-select">{checkbox(row)}</td>}
          {columns.map(column => <td key={column.id} data-align={column.align} data-primary={column.primary || undefined} className={cn(widthClass(column), column.className) || undefined}>
            {column === primary ? column.secondary ? <span className="oc-dt-primary">{openControl(row, column.cell(row))}{column.secondary(row)}</span> : openControl(row, column.cell(row)) : column.cell(row)}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <ul className="oc-dt-cards" aria-label={caption}>{rows.map(row => <li key={rowKey(row)} data-list-card="" data-state={rowState?.(row)} data-selectable={selection ? "" : undefined}>
      {selection && <span className="oc-dt-card-select">{checkbox(row)}</span>}
      {/* Only the title is inside the button (its overlay still covers the card), so the button's visible text is
          the name its accessible label already contains. */}
      <span className="oc-dt-card-body">
        {openControl(row, <span className="oc-dt-card-title">{card.title(row)}</span>, true)}
        {card.preview && <span className="oc-dt-card-preview">{card.preview(row)}</span>}
        {card.meta && <span className="oc-dt-card-meta">{card.meta(row)}</span>}
      </span>
      {card.trailing && <span className="oc-dt-card-trailing">{card.trailing(row)}</span>}
      {card.actions && <span className="oc-dt-card-actions">{card.actions(row)}</span>}
    </li>)}</ul>
  </div>
}

/** Muted secondary text that sits on the name's line in a table (email, ID). Hidden below `from`. */
export function DataTableSecondary({ children, from, title }: { children: ReactNode; from?: DataTableWidth; title?: string }) {
  return <span className={cn("oc-dt-secondary", from && `oc-dt-from-${from}`)} title={title}>{children}</span>
}


