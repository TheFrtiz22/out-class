import Image from "next/image"
import "./campus-band.css"

/** The Lawn colonnade, anchored right, with the "Built at UVA" copy on a navy glass card to its left. */
export function CampusBand() {
  return (
    <section className="oc-campus-band" aria-labelledby="campus-band-title">
      <Image className="oc-campus-band-photo" src="/images/campus/colonnade-1600.webp" alt="" fill sizes="(max-width: 820px) 100vw, 70vw" loading="lazy" />
      <div className="oc-campus-band-inner">
        <div className="oc-campus-band-card oc-public-glass-navy">
          <p className="oc-campus-band-kicker">Built at UVA</p>
          <h2 id="campus-band-title">Made by students on Grounds.</h2>
          <p>We’re rolling out with participating clubs one at a time, testing the real workflow and fixing what doesn’t work before taking it to other campuses.</p>
          <a className="oc-campus-band-link" href="/about">About OutClass</a>
        </div>
      </div>
    </section>
  )
}
