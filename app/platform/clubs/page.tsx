import { loadAdminClubs } from "@/actions/admin-clubs";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import { AdminClubs } from "@/components/admin/admin-clubs";
import { PageHeader } from "@/components/product/page-header";
export default async function AdminClubsPage() {
  const result = await loadAdminClubs();
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  return <div className="min-w-0 space-y-6 p-5 sm:p-8"><PageHeader eyebrow="OutClass · Administration" title="Clubs" description="Manage club identities, public profiles and visibility. Recruitment and club operations retain their canonical controls." /><AdminClubs initial={result.value!} /></div>;
}
