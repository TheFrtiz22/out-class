/** Original schematic placeholder, not a photograph or an official UVA mark.
 * Replace only with an approved campus asset; retain the reserved geometry.
 */
export function CampusBackdrop() {
  return <div className="oc-campus-backdrop" aria-hidden="true">
    <svg viewBox="0 0 1440 500" preserveAspectRatio="xMidYMax slice" fill="none" className="oc-campus-drawing">
      <path d="M0 446C260 427 384 459 649 438S1164 423 1440 445V500H0Z" fill="#e5e8dd" />
      <g stroke="#a9b5b7" strokeWidth="1.5" fill="#f5f2ea">
        <path d="M833 354h340v103H833z" />
        <path d="M851 354v-30h302v30M880 324v-23h245v23" />
        <path d="M910 301c0-91 185-91 185 0Z" fill="#edf0ed" />
        <path d="M914 290c25-66 151-66 177 0M1003 229v-17m-13 0h26" />
        <path d="m846 354 157-67 157 67Z" fill="#fcfaf5" />
        <path d="m886 343 117-47 117 47Z" />
        <path d="M865 363h277v12H865zM865 443h277v12H865z" />
        {[883,925,967,1009,1051,1093].map(x => <g key={x}><path d={`M${x} 375h16v68h-16z`} fill="#fffdf8" /><path d={`M${x-3} 375h22m-22 68h22`} /></g>)}
        <path d="M850 457h305v8H850zm-14 8h333v8H836zm-14 8h361v8H822z" />
        <path d="M0 393h805v67H0m1185-67h255v67h-255M0 385h805v8H0m1185-8h255v8h-255" />
        {[40,100,160,220,280,340,400,460,520,580,640,700,760,1220,1280,1340,1400].map(x => <path key={x} d={`M${x} 402v50m14-50v50`} />)}
      </g>
      <path d="M970 483 900 500m157-17 73 17" stroke="#c7c6b9" />
    </svg>
  </div>
}
