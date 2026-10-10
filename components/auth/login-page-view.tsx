"use client"

import { AuthView } from "@/components/views/auth-view"
import { authEntryHref } from "@/lib/auth"

export function LoginPageView({ initialError = "" }: { initialError?: string } = {}) {
  return <AuthView
    initialError={initialError}
    onCreateAccount={() => { window.location.href = authEntryHref("/signup", window.location.search) }}
    onBack={() => { window.location.href = "/" }}
    onEnter={() => { window.location.href = "/login" }}
  />
}
