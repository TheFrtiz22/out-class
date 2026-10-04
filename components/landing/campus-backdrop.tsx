/** Supplied and licensed photography; provenance in public/images/campus/README.md. */
const photographs = {
  rotunda: { width: 1592, height: 1062, src: "rotunda-1600.webp", srcSet: "rotunda-960.webp 960w, rotunda-1600.webp 1592w" },
  colonnade: { width: 1600, height: 1200, src: "colonnade-1600.webp", srcSet: "colonnade-960.webp 960w, colonnade-1600.webp 1600w" },
  football: { width: 2500, height: 1666, src: "football-1600.webp", srcSet: "football-960.webp 960w, football-1600.webp 1600w, football-2500.webp 2500w" },
  trees: { width: 2074, height: 2092, src: "autumn-lawn-1600.webp", srcSet: "autumn-lawn-960.webp 960w, autumn-lawn-1600.webp 1600w, autumn-lawn-2074.webp 2074w" },
  "sunset-rotunda": { width: 2500, height: 1667, src: "sunset-rotunda-1600.webp", srcSet: "sunset-rotunda-960.webp 960w, sunset-rotunda-1600.webp 1600w, sunset-rotunda-2500.webp 2500w" },
} as const

export function CampusBackdrop({ view = "rotunda", priority = "high" }: {
  view?: keyof typeof photographs
  priority?: "high" | "auto"
}) {
  const photo = photographs[view]
  return (
    <div className="oc-campus-backdrop" aria-hidden="true">
      <img
        src={`/images/campus/${photo.src}`}
        srcSet={photo.srcSet.split(", ").map(source => `/images/campus/${source}`).join(", ")}
        sizes="100vw"
        width={photo.width}
        height={photo.height}
        alt=""
        fetchPriority={priority}
        decoding="async"
        className="oc-campus-photo"
      />
    </div>
  )
}
