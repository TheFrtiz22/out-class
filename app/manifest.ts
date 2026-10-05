import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OutClass",
    short_name: "OutClass",
    description: "Student organization applications and recruitment.",
    start_url: "/",
    display: "browser",
    background_color: "#fff7ec",
    theme_color: "#14243b",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" }],
  }
}
