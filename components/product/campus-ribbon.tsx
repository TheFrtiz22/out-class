import { cn } from "@/lib/utils"

/** A single continuous campus path: brand texture, never information. */
export function CampusRibbon({ className }: { className?: string }) {
  return <svg className={cn("oc-campus-ribbon", className)} viewBox="0 0 460 240" fill="none" aria-hidden="true" focusable="false">
    <path d="M-35 170C70 170 18 48 123 48C237 48 113 206 235 206C352 206 239 23 356 23C437 23 383 148 487 148" />
    <path d="M-35 183C70 183 18 61 123 61C237 61 113 219 235 219C352 219 239 36 356 36C437 36 383 161 487 161" />
  </svg>
}
