import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"

type IconButtonProps = Omit<ComponentProps<typeof Button>, "asChild" | "size" | "aria-label"> & {
  "aria-label": string
  size?: "icon" | "icon-sm" | "icon-lg"
}

/** Accessible name is mandatory; a tooltip is optional supplementary help. */
export function IconButton({ size = "icon", variant = "ghost", type = "button", ...props }: IconButtonProps) {
  return <Button size={size} variant={variant} type={type} {...props} />
}
