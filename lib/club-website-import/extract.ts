/**
 * Reads a club's public web page into suggested profile fields.
 *
 * Everything here is untrusted page content treated as data: it is parsed with plain string
 * rules, never executed, never sent to a model, and every value is trimmed to the profile's
 * own limits. Links are rebuilt from parsed URLs, https only, so a page cannot smuggle a
 * javascript: or data: link into a profile. The leader reviews every value before saving.
 */

export type ExtractedClubPage = {
  name: string
  tagline: string
  description: string
  color: string | null
  website: string
  email: string
  instagram: string
  linkedin: string
  links: { label: string; url: string }[]
  commitment: string
  logoCandidates: string[]
  bannerCandidates: string[]
}

const named: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•", eacute: "é", egrave: "è",
  aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", laquo: "«", raquo: "»",
}
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : ""
    }
    return named[code.toLowerCase()] ?? whole
  })
}

/** Collapses whitespace and removes control characters. */
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, "").replace(/\s+/g, " ").trim()
const textOf = (html: string) => clean(decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")))

/** Cuts at a sentence end, then a word end, at or before `max` characters. */
export function clip(value: string, max: number): string {
  if (value.length <= max) return value
  const head = value.slice(0, max)
  const sentence = head.match(/^[\s\S]*[.!?](?=\s|$)/)?.[0]
  if (sentence && sentence.length >= max * 0.5) return sentence.trim()
  const word = head.replace(/\s+\S*$/, "")
  return (word.length >= max * 0.5 ? word : head).replace(/[\s,;:–—-]+$/, "") + "…"
}
const firstSentence = (value: string) => value.match(/^.{20,}?[.!?](?=\s|$)/)?.[0] ?? value

/** Decodes a page body using the header charset, then a <meta charset>, then UTF-8. */
export function decodeHtml(body: Uint8Array, headerCharset: string | null): string {
  const sniff = new TextDecoder("latin1").decode(body.subarray(0, 4096))
  const metaCharset = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(sniff)?.[1]
  for (const label of [headerCharset, metaCharset, "utf-8"]) {
    if (!label) continue
    try { return new TextDecoder(label.toLowerCase(), { fatal: false }).decode(body) } catch { /* Unknown label: try the next. */ }
  }
  return new TextDecoder().decode(body)
}

type Tag = { name: string; attrs: Record<string, string> }
function attributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const match of source.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const key = match[1].toLowerCase()
    if (!(key in attrs)) attrs[key] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "")
  }
  return attrs
}
function tags(html: string, names: string[]): Tag[] {
  const pattern = new RegExp(`<(${names.join("|")})\\b([^<>]*)>`, "gi")
  return [...html.matchAll(pattern)].map(match => ({ name: match[1].toLowerCase(), attrs: attributes(match[2] ?? "") }))
}

/** Resolves `value` against the page; https only (an http link is upgraded), no credentials. */
export function absoluteHttps(value: string | undefined | null, base: URL): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || /^(javascript|data|vbscript|blob|file):/i.test(trimmed.replace(/[\s\u0000-\u001f]+/g, ""))) return null
  let url: URL
  try { url = new URL(trimmed, base) } catch { return null }
  if (url.protocol === "http:") url.protocol = "https:"
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null
  url.hash = ""
  const text = url.toString()
  return text.length <= 2000 ? text : null
}

const organizationTypes = /organization|corporation|ngo|club|team|association|university|school|educational|sportsteam|localbusiness/i
type JsonLd = Record<string, unknown>
function jsonLdNodes(html: string): JsonLd[] {
  const nodes: JsonLd[] = []
  const visit = (value: unknown, depth: number) => {
    if (depth > 4 || nodes.length > 50 || !value || typeof value !== "object") return
    if (Array.isArray(value)) { value.slice(0, 50).forEach(item => visit(item, depth + 1)); return }
    const node = value as JsonLd
    nodes.push(node)
    if (Array.isArray(node["@graph"])) visit(node["@graph"], depth + 1)
  }
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1].length > 200000) continue
    try { visit(JSON.parse(match[1].trim()), 0) } catch { /* Malformed JSON-LD is common; skip it. */ }
  }
  return nodes
}
const typeOf = (node: JsonLd) => [node["@type"]].flat().filter((t): t is string => typeof t === "string").join(" ")
const stringOf = (value: unknown): string => typeof value === "string" ? value : ""
const imageOf = (value: unknown): string => typeof value === "string" ? value : value && typeof value === "object" ? stringOf((value as JsonLd).url) || stringOf((value as JsonLd).contentUrl) : Array.isArray(value) ? imageOf(value[0]) : ""

const genericTitle = /^(home|homepage|home page|welcome|about|about us|who we are|contact( us)?|official (web)?site|main|index|untitled)[.!…:]*$/i
/** A page title often reads "Home | Club Name | University"; keep the part that names the club. */
export function clubNameFromTitle(title: string): string {
  const parts = title.split(/\s+(?:\||–|—|-|::|·|•|»)\s+/).map(part => part.replace(/^welcome to\s+(the\s+)?/i, "").trim()).filter(Boolean)
  return parts.find(part => !genericTitle.test(part)) ?? ""
}

function hexColor(value: string | undefined): string | null {
  const raw = value?.trim().toLowerCase() ?? ""
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(raw)
  const hex = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : /^#[0-9a-f]{6}$/.test(raw) ? raw : null
  if (!hex) return null
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // Pure white or near-black theme colors describe the browser chrome, not a brand accent.
  return luminance > 0.85 || luminance < 0.005 ? null : hex
}

const socialRules: { label: string; host: RegExp; path: RegExp; keepQuery?: boolean }[] = [
  { label: "Instagram", host: /(^|\.)instagram\.com$/, path: /^\/(?!p\/|reel|reels\/|explore|accounts|stories|direct)[A-Za-z0-9._]{1,30}\/?$/ },
  { label: "LinkedIn", host: /(^|\.)linkedin\.com$/, path: /^\/(company|school|groups|showcase)\/[^/]+\/?$/ },
  { label: "Facebook", host: /(^|\.)facebook\.com$|^fb\.com$/, path: /^\/(?!sharer|share|dialog|plugins|tr\b|login)[A-Za-z0-9.\-]{2,}\/?$|^\/groups\/[^/]+\/?$/ },
  { label: "X", host: /(^|\.)(twitter|x)\.com$/, path: /^\/(?!intent|share|home|i\/)[A-Za-z0-9_]{1,15}\/?$/ },
  { label: "TikTok", host: /(^|\.)tiktok\.com$/, path: /^\/@[A-Za-z0-9._]{2,24}\/?$/ },
  { label: "YouTube", host: /(^|\.)youtube\.com$/, path: /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/ },
  { label: "Discord", host: /^discord\.gg$|(^|\.)discord\.com$/, path: /^\/(invite\/)?[A-Za-z0-9-]{2,32}\/?$/ },
  { label: "GroupMe", host: /(^|\.)groupme\.com$/, path: /^\/join_group\/\d+\/[A-Za-z0-9]+\/?$/ },
  { label: "Linktree", host: /^linktr\.ee$/, path: /^\/[A-Za-z0-9._]{2,}\/?$/ },
  { label: "GitHub", host: /^github\.com$/, path: /^\/[A-Za-z0-9-]{1,39}\/?$/ },
]
/** Recognizes a club's own social profile link; share buttons and single posts are skipped. */
export function socialLink(href: string): { label: string; url: string } | null {
  let url: URL
  try { url = new URL(href) } catch { return null }
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "")
  const rule = socialRules.find(r => r.host.test(host) && r.path.test(url.pathname))
  if (!rule) return null
  return { label: rule.label, url: `https://${host}${url.pathname.replace(/\/$/, "")}` }
}

const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/i
function emailFrom(value: string): string {
  const address = decodeURIComponent(value.replace(/^mailto:/i, "").split("?")[0]).trim().toLowerCase()
  if (!emailPattern.test(address) || address.length > 254) return ""
  if (/(^|\.)(example\.(com|org|net)|sentry\.io|wixpress\.com|domain\.com)$/.test(address.split("@")[1]) || /^(no-?reply|donotreply|user|name|email|your)@/.test(address)) return ""
  return address
}

const boilerplate = /lorem ipsum|introduce the visitor|cookie|copyright|©|all rights reserved|javascript|privacy policy|terms of (use|service)|sign up for our newsletter|subscribe to|powered by|enable js|browser (is|does)/i
const meetingSentence = /\b(we meet|meets? (every|weekly|biweekly|on|in|at)|meetings? (are|is) (held|on|every)|general (body )?meetings?|gbms?\b|weekly meetings?)\b/i

/** Reads profile suggestions from a page's HTML. `pageUrl` is the address the page was served from. */
export function extractClubPage(rawHtml: string, pageUrl: URL): ExtractedClubPage {
  const withoutComments = rawHtml.slice(0, 3_000_000).replace(/<!--[\s\S]*?-->/g, " ")
  const ld = jsonLdNodes(withoutComments).filter(node => organizationTypes.test(typeOf(node)))
  const org = ld[0] ?? {}
  const html = withoutComments.replace(/<(script|style|noscript|template|svg|iframe|object)\b[\s\S]*?<\/\1\s*>/gi, " ")

  const meta = new Map<string, string>()
  for (const tag of tags(html, ["meta"])) {
    const key = (tag.attrs.property || tag.attrs.name || tag.attrs.itemprop || "").toLowerCase()
    if (key && tag.attrs.content && !meta.has(key)) meta.set(key, clean(tag.attrs.content))
  }
  const links = tags(html, ["link"])
  const anchors = tags(html, ["a"]).map(tag => tag.attrs.href ?? "").filter(Boolean)
  const title = textOf(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "")
  const h1 = textOf(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "")

  const name = clip(clean(decodeEntities(stringOf(org.name))) || meta.get("og:site_name") || meta.get("application-name") || clubNameFromTitle(meta.get("og:title") ?? "") || clubNameFromTitle(title) || (h1.length <= 120 ? clubNameFromTitle(h1) : ""), 150)

  const main = /<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(html)?.[2] ?? html
  const paragraphsIn = (fragment: string) => [...new Set([...fragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => textOf(match[1])).filter(text => text.length >= 50 && !boilerplate.test(text)))]
  const uniqueParagraphs = paragraphsIn(main)
  // A club's own "About" block describes it better than event cards or news further down the page.
  const aboutStart = /<(section|div|article)\b[^>]*\b(id|class)\s*=\s*["'][^"']*\babout(-?us)?\b[^"']*["'][^>]*>/i.exec(html) ?? /<h[1-3]\b[^>]*>\s*(about|who we are|our mission)\b/i.exec(html)
  const aboutBlock = aboutStart ? html.slice(aboutStart.index + aboutStart[0].length).slice(0, 15000) : ""
  const aboutEnd = aboutBlock.search(/<section\b|<h[12]\b|<footer\b/i)
  const aboutParagraphs = paragraphsIn(aboutEnd > 0 ? aboutBlock.slice(0, aboutEnd) : aboutBlock)
  const summary = meta.get("og:description") || meta.get("description") || meta.get("twitter:description") || clean(decodeEntities(stringOf(org.description)))
  let body = ""
  for (const paragraph of (aboutParagraphs.length ? aboutParagraphs : uniqueParagraphs).slice(0, 4)) { if ((body + paragraph).length > 1500) break; body = body ? `${body}\n\n${paragraph}` : paragraph }
  const ldDescription = clean(decodeEntities(stringOf(org.description)))
  const descriptionSource = body.length >= 120 ? body : ldDescription.length > (summary?.length ?? 0) ? ldDescription : body || summary || ""
  const description = clip(descriptionSource, 2000)
  // A tagline is one line: the page's own summary, or the first sentence of the description.
  const taglineSource = clean(summary || description.split(/\n{2,}/)[0] || "")
  const tagline = clip(taglineSource.length > 200 ? firstSentence(taglineSource) : taglineSource, 200)

  const hrefs = [...anchors, ...[org.sameAs].flat().map(stringOf)].map(href => absoluteHttps(href, pageUrl)).filter((href): href is string => !!href)
  const socials: { label: string; url: string }[] = []
  for (const href of hrefs) {
    const social = socialLink(href)
    if (social && !socials.some(existing => existing.url.toLowerCase() === social.url.toLowerCase() || existing.label === social.label)) socials.push(social)
  }
  const email = [stringOf(org.email), ...anchors.filter(href => /^mailto:/i.test(href.trim()))].map(emailFrom).find(Boolean) ?? ""

  const sentences = [...uniqueParagraphs, ...[...main.matchAll(/<(li|h[2-4]|dd|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(match => textOf(match[2]))].flatMap(text => text.split(/(?<=[.!?])\s+/))
  const meeting = sentences.find(sentence => meetingSentence.test(sentence) && sentence.length >= 15 && sentence.length <= 150) ?? ""

  const iconSize = (sizes: string | undefined) => Math.max(0, ...(sizes ?? "").split(/\s+/).map(size => parseInt(size, 10)).filter(Number.isFinite))
  const icons = links
    .filter(tag => /(^|\s)(apple-touch-icon(-precomposed)?|icon)(\s|$)/i.test(tag.attrs.rel ?? "") && !/\.(svg|ico)(\?|$)/i.test(tag.attrs.href ?? "") && !/svg|icon/i.test(tag.attrs.type ?? ""))
    .map(tag => ({ href: tag.attrs.href, score: iconSize(tag.attrs.sizes) || (/apple-touch/i.test(tag.attrs.rel ?? "") ? 180 : 0) }))
    .filter(icon => icon.score >= 96)
    .sort((a, b) => b.score - a.score)
  const logoImages = tags(html, ["img"]).filter(tag => /logo/i.test(`${tag.attrs.class ?? ""} ${tag.attrs.id ?? ""} ${tag.attrs.alt ?? ""} ${tag.attrs.src ?? ""}`) && !/\.svg(\?|$)/i.test(tag.attrs.src ?? "")).map(tag => tag.attrs.src)
  const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => !!value))]
  const logoCandidates = unique([imageOf(org.logo), meta.get("og:logo") ?? "", ...logoImages.slice(0, 2), ...icons.map(icon => icon.href)].map(value => absoluteHttps(value, pageUrl))).slice(0, 4)
  const bannerCandidates = unique([meta.get("og:image") ?? "", meta.get("og:image:url") ?? "", meta.get("twitter:image") ?? ""].map(value => absoluteHttps(value, pageUrl))).filter(url => !logoCandidates.includes(url)).slice(0, 2)

  const website = absoluteHttps(pageUrl.toString(), pageUrl) ?? ""
  return {
    name, tagline, description,
    color: hexColor(meta.get("theme-color") ?? meta.get("msapplication-tilecolor")),
    website: website.replace(/\/$/, ""),
    email,
    instagram: socials.find(s => s.label === "Instagram")?.url ?? "",
    linkedin: socials.find(s => s.label === "LinkedIn")?.url ?? "",
    links: socials.filter(s => s.label !== "Instagram" && s.label !== "LinkedIn").slice(0, 12),
    commitment: meeting,
    logoCandidates, bannerCandidates,
  }
}
