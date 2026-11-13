import { brandIcon } from "@/lib/brand-icon"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  // Opaque PNG of the white OC tile (iOS paints transparent corners black on the home screen).
  return brandIcon(size.width, "brand/pwa/apple-touch-icon-180.png")
}
