import type { ComponentProps } from "react"
import { ChevronDown } from "@/components/icons"
import { cn } from "@/lib/utils"

/** Keep native option, keyboard, form, and change semantics; share the field treatment. */
export function NativeSelect({ className, density = "default", ...props }: ComponentProps<"select"> & { density?: "default" | "compact" }) {
  return <select data-slot="native-select" data-density={density} className={cn("oc-native-select", className)} {...props} />
}

/** Native menu semantics with a predictable inset caret. className sizes the field. */
export function NativeSelectField({ className, ...props }: ComponentProps<typeof NativeSelect>) {
  return <span className={cn("oc-native-select-field", className)}>
    <NativeSelect {...props} />
    <ChevronDown className="oc-native-select-caret" aria-hidden="true" />
  </span>
}
