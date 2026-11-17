"use client"

import { AuthView } from "@/components/views/auth-view"
import { authEntryHref } from "@/lib/auth"
import { clubContextLine } from "@/lib/auth-club-context"

export function LoginPageView({ initialError = "", club }: { initialError?: string; club?: { name: string; follow: boolean } } = {}) {
  return <AuthView
    initialError={initialError}
    description={club ? clubContextLine(club.name, club.follow, "login") : undefined}
    onCreateAccount={() => { window.location.href = authEntryHref("/signup", window.location.search) }}
    onBack={() => { window.location.href = "/" }}
    onEnter={() => { window.location.href = "/login" }}
  />
}
