import { loadAdminClubs } from "@/actions/admin-clubs";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import { AdminClubs } from "@/components/admin/admin-clubs";
import { PageHeader } from "@/components/product/page-header";
export default async function AdminClubsPage() {
  const result = await loadAdminClubs();
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  return <div className="min-w-0 oc-workspace-stack oc-admin-workspace"><PageHeader eyebrow="OutClass · Administration" title="Clubs" description="Manage club identities, public profiles and visibility. Recruitment and club operations retain their canonical controls." /><AdminClubs initial={result.value!} /></div>;
}
