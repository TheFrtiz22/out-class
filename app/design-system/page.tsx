import { notFound, unstable_rethrow } from "next/navigation"
import { AdminAccessError } from "@/lib/admin-failure"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { DesignSystemReference } from "./design-system-reference"

export const dynamic = "force-dynamic"

/** Internal visual reference for platform administrators. Everyone else gets a 404, so the route is not advertised. */
export default async function DesignSystemPage() {
  try {
    await requirePlatformAdmin()
  } catch (error) {
    unstable_rethrow(error)
    if (error instanceof AdminAccessError) notFound()
    throw error
  }
  return <DesignSystemReference />
}
