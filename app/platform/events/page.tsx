import { adminPageLoad } from "@/utils/admin-page";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import Link from "next/link";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { PageHeader } from "@/components/product/page-header";
import { EventApprovals } from "@/components/events/event-approvals";
export default async function EventApprovalsPage() {
  const result = await adminPageLoad("/platform/events", requirePlatformAdmin);
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  return (
    <main data-workspace-detail className="mx-auto max-w-6xl space-y-6 p-6">
      <Link href="/platform" className="underline">
        Admin workspace
      </Link>
      <PageHeader
        eyebrow="OutClass · Administration"
        title="Event Approvals"
        description="Review public campus events before their flyers appear on Corkboard."
      />
      <EventApprovals />
    </main>
  );
}
