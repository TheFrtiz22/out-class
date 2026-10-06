import { PageHeader } from "@/components/product/page-header";
import Link from "next/link";
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
    <main data-workspace-detail className="mx-auto max-w-6xl space-y-6 p-6">
      <Link className="underline" href="/">
        Personal workspace
      </Link>
      <PageHeader eyebrow="OutClass · Administration" title="OutClass platform administration" description="Protected platform controls. Changes require a reason and confirmation; every operation is audited." illustration={{ variant: "columns", treatment: "quiet", accent: false }} />
      <a className="block underline" href="/platform/claims">Review club claims</a>
      <PlatformConsole />
    </main>
  )
}
