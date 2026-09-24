import { requirePlatformAdmin } from "@/utils/platform-admin"
import { PlatformConsole } from "@/components/platform-console"
import { redirect } from "next/navigation"
export default async function PlatformPage() {
  try {
    await requirePlatformAdmin()
  } catch {
    redirect("/platform/login")
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <a className="underline" href="/">
        Personal workspace
      </a>
      <h1 className="font-display text-3xl">OutClass platform administration</h1>
      <p>Privileged operations are audited. Viewing a user does not impersonate their session.</p>
      <a className="block underline" href="/platform/claims">Review club claims</a>
      <PlatformConsole />
    </main>
  )
}
