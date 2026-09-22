/** Licensed photograph; source and attribution in public/images/campus/README.md. */
export function CampusBackdrop() {
  return (
    <div className="oc-campus-backdrop" aria-hidden="true">
      <img
        src="/images/campus/rotunda-1600.webp"
        srcSet="/images/campus/rotunda-960.webp 960w, /images/campus/rotunda-1600.webp 1592w"
        sizes="100vw"
        width={1592}
        height={1062}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="oc-campus-photo"
      />
    </div>
  )
}
