import { adminPageLoad } from "@/utils/admin-page";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import { getAdminOverview } from "@/actions/admin-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { Dashboard, DashboardCard, DashboardHero, GlassRow, GlassRowList, MetricTiles, NeedsAction, NeedsYouRow } from "@/components/product/dashboard/dashboard";

export default async function PlatformPage() {
  const result = await adminPageLoad("/platform", getAdminOverview, "ADMIN_DATA_LOAD_FAILED");
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  const metrics = result.value!;
  const labels = { students: "Students", clubs: "Clubs", eventApprovals: "Pending event approvals", clubApprovals: "Pending club approvals", reports: "Open reports", upcomingEvents: "Upcoming approved events", supportItems: "Support items" };
  const attention = [{ key: "eventApprovals" as const, label: "Review pending events", noun: "event approval", href: "/platform/events" }, { key: "clubApprovals" as const, label: "Review club claims", noun: "club claim", href: "/platform/claims" }, { key: "reports" as const, label: "Investigate reports", noun: "open report", href: "/platform/reports" }, { key: "supportItems" as const, label: "Help with support requests", noun: "support request", href: "/platform/support" }];
  const open = attention.filter(i => metrics[i.key] > 0);
  const queues = [...attention, { key: null, label: "School requests", noun: "", href: "/platform/school-requests" }];
  return <div className="oc-workspace-stack oc-admin-workspace">
    <DashboardHero glow="neutral" className="oc-admin-hero">
      <PageHeader density="expressive" eyebrow="OutClass · Administration" title="What needs your attention?" description="Review requests, help people, and keep Grounds connected." />
    </DashboardHero>
    <Dashboard className="oc-admin-dashboard">
      <NeedsYouRow headingId="admin-attention" heading="Needs Attention" className="oc-admin-attention"
        items={open.map(i => ({ id: i.key, title: `${metrics[i.key]} ${i.noun}${metrics[i.key] === 1 ? "" : "s"}`, detail: "Approvals, reports and support", action: <NeedsAction href={i.href}>{i.label}</NeedsAction> }))}
        clear={<><strong>No open approvals, reports, or support requests need attention.</strong> New requests will show up here.</>} />
      <div className="oc-dashboard-grid">
        <div className="oc-dashboard-main">
          <DashboardCard id="admin-metrics" title="Platform at a glance">
            <section aria-label="Platform metrics"><MetricTiles label="Platform metrics" size="large" items={Object.entries(labels).map(([key, label]) => ({ key, label, value: metrics[key as keyof typeof metrics] }))} /></section>
          </DashboardCard>
        </div>
        <div className="oc-dashboard-side">
          <DashboardCard id="admin-queues" title="Queues">
            <GlassRowList>{queues.map(q => <li key={q.href}><GlassRow href={q.href} title={q.key ? q.label : "Review school requests"} detail={q.key ? `${metrics[q.key]} open` : "New schools asking to join OutClass"} /></li>)}</GlassRowList>
          </DashboardCard>
        </div>
      </div>
    </Dashboard>
  </div>;
}
