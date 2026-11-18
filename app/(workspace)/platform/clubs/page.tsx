import { loadAdminClubs } from "@/actions/admin-clubs";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import { AdminClubs } from "@/components/admin/admin-clubs";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Clubs · Admin", robots: { index: false, follow: false } }
export default async function AdminClubsPage() {
  const result = await loadAdminClubs();
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  return <div className="min-w-0 oc-workspace-stack oc-admin-workspace"><PageHeader eyebrow="OutClass · Administration" title="Clubs" description="Manage club identities, public profiles and visibility. Recruiting and day-to-day club settings stay with each club." /><AdminClubs initial={result.value!} /></div>;
}
