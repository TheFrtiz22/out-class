"use client"

import { Children, isValidElement, useRef, type ComponentProps, type ReactNode } from "react"
import { Slot } from "@radix-ui/react-slot"
import { useScrollMotion } from "@/hooks/use-scroll-motion"
import { cn } from "@/lib/utils"
import "./scroll-motion.css"

export function ScrollMotion({ children, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollMotion(ref)
  return <div ref={ref} data-scroll-motion="" {...props}>{children}</div>
}

export function SectionReveal({ className, ...props }: ComponentProps<"section">) {
  return <section data-motion-section="" className={cn("oc-motion-section", className)} {...props} />
}

type RevealProps = ComponentProps<"div"> & { asChild?: boolean }
/** Preserve the caller's heading/paragraph semantics rather than splitting text. */
export function TextReveal({ asChild = false, ...props }: RevealProps) {
  const Component = asChild ? Slot : "div"
  return <Component data-motion="text" {...props} />
}
export function PreviewReveal({ asChild = false, ...props }: RevealProps) {
  const Component = asChild ? Slot : "div"
  return <Component data-motion="visual" {...props} />
}
export function StaggerReveal({ children, className, ...props }: ComponentProps<"div">) {
  return <div className={className} {...props}>{Children.map(children, (child, index) => isValidElement(child)
    ? <Slot data-motion="body" data-motion-index={Math.min(index, 4)}>{child}</Slot>
    : child)}</div>
}

/** CSS-native depth; static fallback when scroll timelines are unsupported. */
export function DepthTransition({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("oc-motion-depth", className)} {...props} />
}

/** Copy sticks only on roomy desktop viewports; never pins mobile reading. */
export function StickyStory({ className, ...props }: ComponentProps<"article">) {
  return <article data-motion-section="" className={cn("oc-motion-story", className)} {...props} />
}

/** Reveal the truthful final value; never count through invented intermediate data. */
export function StatReveal({ value, label, className, ...props }: Omit<ComponentProps<"div">, "children"> & { value: ReactNode; label: string }) {
  return <div data-motion="stat" className={cn("oc-motion-stat", className)} {...props}><span className="tabular-nums">{value}</span><span>{label}</span></div>
}
