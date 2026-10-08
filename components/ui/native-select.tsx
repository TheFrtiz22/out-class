import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/** Keep native option, keyboard, form, and change semantics; share the field treatment. */
export function NativeSelect({ className, density = "default", ...props }: ComponentProps<"select"> & { density?: "default" | "compact" }) {
  return <select data-slot="native-select" data-density={density} className={cn("oc-native-select", className)} {...props} />
}
