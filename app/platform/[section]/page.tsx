import { notFound, redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { adminNavigation } from "@/lib/admin-navigation";
import { PageHeader } from "@/components/product/page-header";
import { AdminCorkboard } from "@/components/admin/admin-corkboard";
import { AdminDirectory } from "@/components/admin/admin-directory";
import { AdminOnboarding } from "@/components/admin/admin-onboarding";
import { AdminReports } from "@/components/admin/admin-reports";
import { AdminSettings } from "@/components/admin/admin-settings";
import { AdminPermissions } from "@/components/admin/admin-permissions";
import type { PlatformResource } from "@/actions/platform-admin";
export default async function AdminSection({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requirePlatformAdmin(); } catch { redirect("/platform/login"); }
  const { section } = await params, search = await searchParams;
  const entry = adminNavigation.find(i => i.id === section);
  if (!entry) notFound();
  const resources: Record<string, PlatformResource> = { users: "users", clubs: "clubs", corkboard: "meetings", applications: "applications", activity: "audit", audit: "audit" };
  const userId = typeof search.userId === "string" ? search.userId : "", clubId = typeof search.clubId === "string" ? search.clubId : "";
  return <div className="space-y-6 p-5 sm:p-8"><PageHeader eyebrow="OutClass · Administration" title={entry.label} description={section === "applications" ? "Investigate applications and pipeline issues. Platform oversight does not grant club committee membership." : section === "support" ? "Find a person or club, investigate a request, and start an attributed support session." : "Protected platform operations. Every inspection and change is attributed to your account."} />
    {section === "corkboard" ? <AdminCorkboard /> : section === "onboarding" ? <AdminOnboarding /> : section === "permissions" ? <AdminPermissions userId={userId} /> : section === "settings" ? <AdminSettings /> : section === "reports" ? <AdminReports /> : section === "support" ? <><AdminDirectory resource="users" /><AdminReports support /></> : section === "activity" ? <><AdminDirectory resource="audit" /><h2 className="text-xl font-semibold">Support sessions</h2><AdminDirectory resource="view-sessions" /></> : resources[section] ? <AdminDirectory resource={resources[section]} initialUserId={userId} initialClubId={clubId} /> : null}
  </div>;
}
