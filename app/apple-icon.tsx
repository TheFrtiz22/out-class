import { brandIcon } from "@/lib/brand-icon"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  // Serve the PNG traced from the primary OC vector for reliable iOS/Next rendering.
  return brandIcon(size.width, "apple-icon.png")
}
