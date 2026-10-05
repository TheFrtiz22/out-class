import { brandIcon } from "@/lib/brand-icon"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  // Keep the artwork name here so replacing it also changes Next's icon URL.
  return brandIcon(size.width, "outclass-favicon-interlocking.png")
}
