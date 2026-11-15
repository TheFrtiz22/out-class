import type { MetadataRoute } from "next"
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from "@/lib/pwa"

// Installable app (S1-7). Icons are rasterized from premium-board/11_app_icon_white.svg; the
// maskable one keeps the monogram inside the 80% safe zone on the tile's own navy gradient.

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "OutClass",
    short_name: "OutClass",
    description: "Student organization applications and recruitment.",
    // The source tag tells installed launches apart in analytics; no route reads it.
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    icons: [
      { src: "/brand/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/premium-board/11_app_icon_white.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  }
}
