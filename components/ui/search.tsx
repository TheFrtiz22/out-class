import type { ComponentProps } from "react"
import { Search as SearchIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchProps = Omit<ComponentProps<typeof Input>, "type" | "aria-label"> & {
  "aria-label": string
  containerClassName?: string
}

/** Controlled or uncontrolled, just like Input. Does not own filtering state. */
export function Search({ className, containerClassName, ...props }: SearchProps) {
  return <div className={cn("relative", containerClassName)}>
    <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input type="search" className={cn("pl-9", className)} {...props} />
  </div>
}
