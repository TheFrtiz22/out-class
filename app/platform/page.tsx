import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminOverview } from "@/actions/admin-workspace";
import { PageHeader } from "@/components/product/page-header";
export default async function PlatformPage() {
  let metrics;
  try { metrics = await getAdminOverview(); } catch { redirect("/platform/login"); }
  const labels = { students: "Students", clubs: "Clubs", eventApprovals: "Pending event approvals", clubApprovals: "Pending club approvals", reports: "Open reports", upcomingEvents: "Upcoming approved events", supportItems: "Support items" };
  const attention = [{ key: "eventApprovals" as const, label: "Review pending events", href: "/platform/events" }, { key: "clubApprovals" as const, label: "Review club claims", href: "/platform/claims" }, { key: "reports" as const, label: "Investigate reports", href: "/platform/reports" }, { key: "supportItems" as const, label: "Help with support requests", href: "/platform/support" }];
  return <div className="space-y-7 p-5 sm:p-8"><PageHeader eyebrow="OutClass · Administration" title="What needs your attention?" description="Your platform at a glance. Review requests, help people, and keep Grounds connected." illustration={{ variant: "columns", treatment: "quiet", accent: false }} />
    <section aria-label="Platform metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(labels).map(([key, label]) => <div key={key} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold text-primary">{metrics[key as keyof typeof metrics]}</p></div>)}</section>
    <section className="rounded-xl border bg-card p-6"><h2 className="mb-4 text-xl font-semibold">Needs Attention</h2>{attention.some(i => metrics[i.key] > 0) ? <ul className="divide-y">{attention.filter(i => metrics[i.key] > 0).map(i => <li key={i.key}><Link className="flex min-h-14 items-center justify-between gap-3 text-primary underline underline-offset-4" href={i.href}>{i.label}<span>{metrics[i.key]}</span></Link></li>)}</ul> : <p className="text-muted-foreground">No open approvals, reports, or support requests need attention.</p>}</section>
  </div>;
}
