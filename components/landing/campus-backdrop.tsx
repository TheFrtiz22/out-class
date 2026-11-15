import Image from "next/image"

/** Openly licensed photography only; licenses and credits in public/images/campus/README.md and lib/photo-credits.ts. */
const photographs = {
  rotunda: { width: 1592, height: 1062, src: "rotunda-1600.webp" },
  colonnade: { width: 1600, height: 1200, src: "colonnade-1600.webp" },
} as const

export function CampusBackdrop({ view = "rotunda", priority = "high" }: {
  view?: keyof typeof photographs
  priority?: "high" | "auto"
}) {
  const photo = photographs[view]
  return (
    <div className="oc-campus-backdrop" aria-hidden="true">
      <Image
        src={`/images/campus/${photo.src}`}
        sizes="100vw"
        width={photo.width}
        height={photo.height}
        alt=""
        quality={85}
        loading="eager"
        fetchPriority={priority}
        decoding="async"
        className="oc-campus-photo"
      />
    </div>
  )
}
