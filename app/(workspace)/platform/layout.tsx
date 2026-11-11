import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import { AdminAccessError } from "@/lib/admin-failure";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { logAdminFailure } from "@/utils/admin-page";
import { requirePlatformAdmin } from "@/utils/platform-admin";

/** Server-side admin check before the admin shell renders. /platform/login lives in app/(focus) and is
 * not wrapped by this layout. allowViewAs keeps /platform/view-as reachable during a support session;
 * every page and action keeps its own, stricter requirePlatformAdmin check. */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  try {
    await requirePlatformAdmin({ allowViewAs: true });
  } catch (error) {
    const supportCode = logAdminFailure("/platform", error, "ADMIN_ACCESS_CHECK_FAILED");
    if (!(error instanceof AdminAccessError)) return <AdminShell><AdminRecovery supportCode={supportCode} /></AdminShell>;
    // /platform/login is unavailable while a support session is active, so explain how to leave it instead.
    if ((await cookies()).has(PLATFORM_VIEW_COOKIE)) return <AdminShell><section className="p-8">This support session is unavailable. Use Exit impersonation above to return to your administrator account.</section></AdminShell>;
    redirect("/platform/login");
  }
  return <AdminShell>{children}</AdminShell>;
}
