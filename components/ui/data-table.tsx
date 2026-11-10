import type { ComponentProps, ReactNode } from "react"
import { Table } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/**
 * The one data table: the `.oc-data-surface` card around the shared Table (horizontal scroll,
 * token borders and header styles). `caption` names the table for assistive technology.
 */
export function DataTable({ caption, captionVisible = false, className, tableClassName, children, ...props }: Omit<ComponentProps<"table">, "className"> & { caption: ReactNode; captionVisible?: boolean; className?: string; tableClassName?: string }) {
  return <div data-slot="data-table" className={cn("oc-data-surface", className)}>
    <Table className={tableClassName} {...props}>
      <caption className={captionVisible ? "oc-data-table-caption" : "sr-only"}>{caption}</caption>
      {children}
    </Table>
  </div>
}
