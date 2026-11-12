"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { sealAutosaveDraftsForSignOut } from "@/lib/autosave-store"

/** Sign-out for the disabled-account notice: the same server then client sign-out as the account menu. */
export function AccountUnavailableSignOut() {
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle")
  async function signOut() {
    setState("pending")
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" }); if (!response.ok) throw Error("Could not sign out.")
      const { createClient } = await import("@/utils/supabase/client"); const { error } = await createClient().auth.signOut(); if (error) throw error
      await sealAutosaveDraftsForSignOut(); window.location.assign("/login")
    } catch { setState("failed") }
  }
  return <>
    <Button type="button" className="min-h-12 px-[22px]" loading={state === "pending"} disabled={state === "pending"} onClick={() => void signOut()}>Sign out</Button>
    {state === "failed" && <p role="alert" className="basis-full text-sm text-destructive">Could not sign out. Try again.</p>}
  </>
}
