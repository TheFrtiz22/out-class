/** Licensed photograph; source and attribution in public/images/campus/README.md. */
export function CampusBackdrop({ view = "rotunda" }: { view?: "rotunda" | "colonnade" }) {
  const width = view === "rotunda" ? 1592 : 1600
  const height = view === "rotunda" ? 1062 : 1200
  return (
    <div className="oc-campus-backdrop" aria-hidden="true">
      <img
        src={`/images/campus/${view}-1600.webp`}
        srcSet={`/images/campus/${view}-960.webp 960w, /images/campus/${view}-1600.webp ${width}w`}
        sizes="100vw"
        width={width}
        height={height}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="oc-campus-photo"
      />
    </div>
  )
}
