"use client"
import { useId } from "react"
import { Input } from "@/components/ui/input"

/**
 * Shared authenticator-app pieces for platform-admin and personal two-step sign-in.
 * The QR is Supabase's own otpauth:// enrollment image (a data: SVG), not an OutClass short link,
 * so it is shown as returned rather than through the branded short-link QR component.
 */
export function AuthenticatorQr({ qr, secret }: { qr: string; secret?: string }) {
  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- provider-issued data: URI */}
      <img src={qr} alt="QR code to add OutClass to your authenticator app" width={200} height={200} className="rounded-md border bg-white p-2" />
      {secret && (
        <p className="text-sm">
          <span className="text-muted-foreground">Can’t scan? Enter this key: </span>
          <code className="select-all break-all font-mono">{secret}</code>
        </p>
      )}
    </div>
  )
}

export function AuthenticatorCodeInput({ value, onChange, label = "Authenticator code" }: { value: string; onChange: (value: string) => void; label?: string }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <Input
        id={id}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        required
      />
    </div>
  )
}
