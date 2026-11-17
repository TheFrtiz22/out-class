import { adminPageLoad } from "@/utils/admin-page";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { PageHeader } from "@/components/ui/page-header";
import { EventApprovals } from "@/components/events/event-approvals";
export const metadata = { title: "Event approvals · Admin", robots: { index: false, follow: false } }
export default async function EventApprovalsPage() {
  const result = await adminPageLoad("/platform/events", requirePlatformAdmin);
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  return (
    <section className="oc-workspace-stack">
      <PageHeader
        eyebrow="OutClass · Administration"
        title="Event approvals"
        description="Review public campus events before their flyers appear on Corkboard."
      />
      <EventApprovals />
    </section>
  );
}
