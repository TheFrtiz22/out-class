"use client"

import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal-versions"

/** The answer a clickwrap sends to the server; the versions are the ones this page showed. */
export const clickwrapAnswer = (accepted: boolean) => ({ acceptTerms: accepted, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION })

export const TERMS_SAVE_FAILED = "We couldn't save your agreement. Please try again."

/** Sends a ticked clickwrap; resolves to an error message to show, or null once it is stored. */
export async function saveClickwrapAcceptance(accept: (answer: ReturnType<typeof clickwrapAnswer>) => Promise<{ accepted?: boolean; error?: string }>) {
  try {
    const result = await accept(clickwrapAnswer(true))
    return result && "error" in result && result.error ? result.error : null
  } catch { return TERMS_SAVE_FAILED }
}

/**
 * Unticked "I agree" box with links to the Terms and Privacy Policy (opened in a new tab so a
 * half-filled form is kept). Render it only while TERMS_ACCEPTANCE_REQUIRED, when the pages are public.
 */
export function TermsClickwrap({ checked, onCheckedChange, disabled, id = "accept-terms" }: { checked: boolean; onCheckedChange: (value: boolean) => void; disabled?: boolean; id?: string }) {
  return <div className="flex items-start gap-3 text-sm">
    <Checkbox id={id} className="mt-0.5" required aria-required="true" disabled={disabled} checked={checked} onCheckedChange={value => onCheckedChange(value === true)} />
    <label htmlFor={id} className="leading-snug text-muted-foreground">
      I agree to the OutClass{" "}
      <Link href="/terms" target="_blank" rel="noopener" className="font-medium text-foreground underline underline-offset-2">Terms of Service</Link>{" "}and{" "}
      <Link href="/privacy" target="_blank" rel="noopener" className="font-medium text-foreground underline underline-offset-2">Privacy Policy</Link>.
    </label>
  </div>
}
