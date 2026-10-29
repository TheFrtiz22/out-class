import { adminPageLoad } from "@/utils/admin-page";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import Link from "next/link";
import { getAdminOverview } from "@/actions/admin-workspace";
import { PageHeader } from "@/components/product/page-header";
import { MetricStrip } from "@/components/product/metric-strip";
import { ArrowRight } from "@/components/icons";

export default async function PlatformPage() {
  const result = await adminPageLoad("/platform", getAdminOverview, "ADMIN_DATA_LOAD_FAILED");
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  const metrics = result.value!;
  const labels = { students: "Students", clubs: "Clubs", eventApprovals: "Pending event approvals", clubApprovals: "Pending club approvals", reports: "Open reports", upcomingEvents: "Upcoming approved events", supportItems: "Support items" };
  const attention = [{ key: "eventApprovals" as const, label: "Review pending events", href: "/platform/events" }, { key: "clubApprovals" as const, label: "Review club claims", href: "/platform/claims" }, { key: "reports" as const, label: "Investigate reports", href: "/platform/reports" }, { key: "supportItems" as const, label: "Help with support requests", href: "/platform/support" }];
  return <div className="oc-workspace-stack oc-admin-workspace oc-admin-editorial">
    <PageHeader density="expressive" eyebrow="OutClass · Administration" title="What needs your attention?" description="Review requests, help people, and keep Grounds connected." />
    <section className="oc-content-panel oc-admin-attention" aria-labelledby="admin-attention">
      <div className="oc-panel-heading"><h2 id="admin-attention">Needs Attention</h2><p>Approvals, reports and support</p></div>
      {attention.some(i => metrics[i.key] > 0) ? <ul className="divide-y divide-border">{attention.filter(i => metrics[i.key] > 0).map(i => <li key={i.key}>
        <Link className="flex min-h-14 items-center gap-3 rounded-md px-2 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" href={i.href}><span className="min-w-0 flex-1">{i.label}</span><span className="tabular-nums">{metrics[i.key]}</span><ArrowRight size={16} aria-hidden="true" /></Link>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">No open approvals, reports, or support requests need attention.</p>}
    </section>
    <section aria-label="Platform metrics"><MetricStrip label="Platform metrics" items={Object.entries(labels).map(([key,label]) => ({label,value:metrics[key as keyof typeof metrics]}))} /></section>
  </div>;
}
