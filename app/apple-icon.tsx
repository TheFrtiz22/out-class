import { brandIcon } from "@/lib/brand-icon"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  // Keep the artwork name here so replacing it also changes Next's icon URL.
  return brandIcon(size.width, "outclass-favicon-circle.png")
}
