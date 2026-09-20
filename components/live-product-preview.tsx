"use client"

type PreviewView = "student-dashboard" | "student-profile" | "leader-dashboard" | "interview-workspace"

/** Real, independently navigable portals at their native responsive size. */
export function LiveProductPreview({ view, label }: { view: PreviewView; label: string }) {
  const url = `/preview/?view=${encodeURIComponent(view)}`
  return <div className="live-product-preview">
    <div className="portal-preview-toolbar"><span><i aria-hidden="true" />Interactive demo · try the portal</span><a href={url} target="_blank" rel="noopener noreferrer">Open full screen ↗</a></div>
    <iframe key={view} src={url} title={label} loading="lazy" className="portal-preview-frame" />
  </div>
}
