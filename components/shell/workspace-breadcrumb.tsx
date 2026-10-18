"use client"
import Link from "next/link"
import { Fragment } from "react"
import { canLeaveWorkspace } from "@/lib/product-navigation"

export function WorkspaceBreadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    {items.map((item, index) => <Fragment key={`${item.label}:${index}`}>
      {index > 0 && <span aria-hidden="true">/</span>}
      {item.href && index < items.length - 1 ? <Link href={item.href} className="inline-flex min-h-9 items-center hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>{item.label}</Link> : <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>}
    </Fragment>)}
  </nav>
}
