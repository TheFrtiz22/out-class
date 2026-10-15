export type LandingAudience = "student" | "leader"
export const LANDING_AUDIENCE_PREFERENCE = "outclass-landing-audience"
export const DEFAULT_LANDING_AUDIENCE: LandingAudience = "leader"

export function audienceFromPreference(value: string | null | undefined): LandingAudience | null {
  return value === "students" ? "student" : value === "club-leaders" ? "leader" : null
}

export function audienceFromQuery(value: unknown): LandingAudience | null {
  return value === "student" || value === "leader" ? value : null
}

/** A public preference only; never used to determine an account role. */
export function initialLandingAudience(query: unknown, cookie?: string): LandingAudience {
  return audienceFromQuery(query) ?? audienceFromPreference(cookie) ?? DEFAULT_LANDING_AUDIENCE
}

/** CSSOM changes leave React's server-rendered HTML attributes untouched. */
export function setLandingAudienceGate(audience: LandingAudience) {
  const sheet = typeof document === "undefined" ? null : (document.getElementById("oc-landing-audience-gate") as HTMLStyleElement | null)?.sheet
  if (!sheet) return
  while (sheet.cssRules.length) sheet.deleteRule(0)
  sheet.insertRule(`.oc-landing[data-landing-audience="${audience === "student" ? "leader" : "student"}"]{visibility:hidden}`, 0)
}

// Before marketing can paint, a legacy fragment/storage-only preference hides
// only mismatched markup. CSS rules do not mutate React-owned HTML or suppress warnings.
export const landingAudienceBootScript = `(function(){var a='leader',k='outclass-landing-audience';try{var c=document.cookie.split('; ').find(function(v){return v.indexOf(k+'=')===0});var v=localStorage.getItem(k)||(c&&c.slice(k.length+1));if(v==='students')a='student';else if(v==='club-leaders')a='leader'}catch(e){}var q=new URLSearchParams(location.search).get('audience');if(q==='student'||q==='leader')a=q;var h=location.hash;if(h==='#students')a='student';else if(h==='#club-leaders'||h==='#clubs')a='leader';var s=document.getElementById('oc-landing-audience-gate');if(s&&s.sheet)s.sheet.insertRule('.oc-landing[data-landing-audience="'+(a==='student'?'leader':'student')+'"]{visibility:hidden}',0)})();`
