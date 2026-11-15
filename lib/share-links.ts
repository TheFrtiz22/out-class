/**
 * Links for the share sheet (components/share/share-sheet.tsx). Pure so tests can check every
 * channel without a browser. Each channel only receives the public URL plus a short line of
 * text the sharer can see before sending; nothing private is ever put in a share link.
 */
export type ShareChannel = "messages" | "instagram" | "whatsapp" | "email" | "linkedin" | "x"

export type SharePayload = {
  /** Absolute public URL of the page being shared. */
  url: string
  /** Name of the thing being shared, used as the email subject. */
  title: string
  /** One line that goes before the link, e.g. "Check out TAMID on OutClass". */
  text: string
}

export const SHARE_CHANNELS: readonly ShareChannel[] = ["messages", "instagram", "whatsapp", "email", "linkedin", "x"]

export const SHARE_CHANNEL_LABELS: Record<ShareChannel, string> = {
  messages: "Messages",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  email: "Email",
  linkedin: "LinkedIn",
  x: "X",
}

/** Instagram has no web "share this link" URL, so the sheet copies the link and opens DMs. */
export const INSTAGRAM_DIRECT_URL = "https://www.instagram.com/direct/inbox/"

const enc = encodeURIComponent
const line = (text: string, url: string) => (text.trim() ? `${text.trim()} ${url}` : url)

/** Collapses whitespace and caps the length so a long event title can't produce a huge link. */
export function shareText(value: string, max = 180) {
  const clean = value.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

export function shareHref(channel: ShareChannel, payload: SharePayload): string {
  const { url } = payload
  const text = shareText(payload.text)
  switch (channel) {
    // `sms:?&body=` is the form both iOS and Android Messages accept.
    case "messages": return `sms:?&body=${enc(line(text, url))}`
    case "instagram": return INSTAGRAM_DIRECT_URL
    case "whatsapp": return `https://wa.me/?text=${enc(line(text, url))}`
    case "email": return `mailto:?subject=${enc(shareText(payload.title, 120))}&body=${enc(text ? `${text}\n\n${url}` : url)}`
    case "linkedin": return `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`
    case "x": return `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`
  }
}

/** Channels that open a website (new tab) rather than an app handler (sms:, mailto:). */
export function opensWebsite(channel: ShareChannel) {
  return channel !== "messages" && channel !== "email"
}

/** Public path of a club profile. */
export const clubSharePath = (clubId: string) => `/club/${encodeURIComponent(clubId)}`

/** Public path that opens one event on the campus Events board. */
export const eventSharePath = (eventId: string) => `/corkboard?event=${encodeURIComponent(eventId)}`
