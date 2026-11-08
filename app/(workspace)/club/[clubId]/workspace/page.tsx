import { AuthenticatedPageLayout } from "@/components/shell/authenticated-page-layout";
import { cookies } from "next/headers";
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { getSessionUser } from "@/utils/auth";
import { getCurrentUser } from "@/utils/current-user";
import Link from "next/link";
import { ClubWorkspace } from "@/components/club-workspace";
import { AuthSessionBoundary } from "@/components/auth-session-boundary";
import { redirect } from "next/navigation";
import { legacyApplicantInterviewHref } from "@/lib/applicant-interview-navigation";
import { legacyInterviewRoomHref } from "@/lib/interview-entry";
import { PageHeader } from "@/components/ui/page-header";
import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceRouteLoading } from "@/components/shell/workspace-route-loading";
import { clubWorkspaceTitle, canonicalClubWorkspaceHref } from "@/lib/workspace-routes";
export const maxDuration = 60;
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  return { title: clubWorkspaceTitle(await searchParams) };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clubId } = await params, query = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const section = first(query.section), taskView = first(query.taskView), tool = first(query.tool);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  const moved = canonicalClubWorkspaceHref(clubId, search) ?? legacyApplicantInterviewHref(clubId, search.toString()) ?? legacyInterviewRoomHref(clubId, search.toString());
  if (moved) redirect(moved);
  // No route loading.tsx: its boundary would stream the persistent shell before this redirect, turning a 307 into
  // a second document load. The placeholder streams from here instead, after the redirect check.
  return <Suspense fallback={<WorkspaceRouteLoading />}><Workspace clubId={clubId} section={section} taskView={taskView} tool={tool} /></Suspense>;
}

async function Workspace({ clubId, section, taskView, tool }: { clubId: string; section?: string; taskView?: string; tool?: string }) {
  const jar = await cookies();
  let demoEnabled = false;
  if (!jar.has(PLATFORM_VIEW_COOKIE) && jar.get(DEMO_COOKIE)?.value === "1") {
    const { data: { user }, error } = await getSessionUser();
    demoEnabled = canAccessDemo(error ? undefined : user?.email);
  }
  const user = demoEnabled ? null : await getCurrentUser();
  const membership = user?.memberships.find(member => member.clubId === clubId);
  if (membership?.club.suspendedAt) return <AuthenticatedPageLayout><div className="max-w-[var(--oc-reading-width)] space-y-4"><PageHeader title="This club is suspended" /><p>{membership.club.name} operations are unavailable until an administrator restores the club. Your membership and existing records are preserved.</p><Link className="underline" href="/home">Return to Personal workspace</Link></div></AuthenticatedPageLayout>;
  return (
    <AuthSessionBoundary>
      <ClubWorkspace
        key={clubId}
        clubId={clubId}
        section={section ?? "overview"}
        taskView={taskView}
        tool={tool}
      />
    </AuthSessionBoundary>
  );
}
