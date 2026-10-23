"use client"

import type { CSSProperties, ReactNode } from "react"

// Flight children can suspend while React reconciles them. Give that work a
// component fiber so React 19 does not replay an already claimed host div with
// its hydration cursor still inside the div (react/react#35494).
function RouteChildren({ children }: { children: ReactNode }) {
  return children
}

export function RouteContent({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="oc-route-content" style={style}><RouteChildren>{children}</RouteChildren></div>
}
