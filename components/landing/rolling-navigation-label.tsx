import type { CSSProperties } from "react"

/** A single accessible label; decorative letters roll within a fixed line box. */
export function RollingNavigationLabel({ children }: { children: string }) {
  return (
    <span className="oc-public-label">
      <span className="oc-public-label-accessible">{children}</span>
      <span className="oc-public-label-visual" aria-hidden="true">
        {Array.from(children).map((letter, index) => (
          <span className="oc-public-letter" key={index}>
            <span className="oc-public-letter-track" style={{ "--letter-delay": `${index / children.length * 140}ms` } as CSSProperties}>
              <span>{letter === " " ? "\u00a0" : letter}</span>
              <span className="oc-public-letter-copy">{letter === " " ? "\u00a0" : letter}</span>
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}
