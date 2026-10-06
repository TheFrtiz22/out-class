import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { PageHeader } from "@/components/product/page-header";
import { EventApprovals } from "@/components/events/event-approvals";
export default async function EventApprovalsPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/platform/login");
  }
  return (
    <main data-workspace-detail className="mx-auto max-w-6xl space-y-6 p-6">
      <Link href="/platform" className="underline">
        Admin workspace
      </Link>
      <PageHeader
        eyebrow="OutClass · Administration"
        title="Event Approvals"
        description="Review public campus events before their flyers appear on Corkboard."
        illustration={{ variant: "columns", treatment: "quiet", accent: false }}
      />
      <EventApprovals />
    </main>
  );
}
