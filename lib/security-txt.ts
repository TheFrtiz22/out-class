import { SITE_URL } from "@/lib/seo"
import { CONTACT_EMAIL } from "@/lib/legal-content"

/**
 * /.well-known/security.txt (RFC 9116). Expires is a fixed date, not "now + 1 year", so the file
 * stops claiming to be current if nobody reviews it: when it is close, confirm the contact and the
 * /security page still hold, then move the date forward (at most a year).
 */
export const SECURITY_TXT_PATH = "/.well-known/security.txt"
export const SECURITY_TXT_EXPIRES = "2027-11-14T00:00:00.000Z"
export const SECURITY_POLICY_PATH = "/security"

export function securityTxt() {
  return [
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${SECURITY_TXT_EXPIRES}`,
    "Preferred-Languages: en",
    `Canonical: ${SITE_URL}${SECURITY_TXT_PATH}`,
    `Policy: ${SITE_URL}${SECURITY_POLICY_PATH}`,
    "",
  ].join("\n")
}
