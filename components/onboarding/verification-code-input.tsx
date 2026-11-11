"use client"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

/** Step 2 of sign-up: the six-digit email code. Its own chunk, so step 1 does not ship input-otp. */
export function VerificationCodeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <InputOTP
      maxLength={6}
      pattern="[0-9]*"
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label="Six-digit verification code"
      value={value}
      onChange={onChange}
    >
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className="h-12 w-[clamp(28px,8vw,48px)] text-lg shadow-none"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
