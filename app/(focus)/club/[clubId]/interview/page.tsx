import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { getSessionUser } from "@/utils/auth";
import { getCurrentUser } from "@/utils/current-user";
import { AuthSessionBoundary } from "@/components/auth-session-boundary";
import { PageHeader } from "@/components/product/page-header";
import { ClubInterviewRoom } from "@/components/interviews/club-interview-room";
import { clubInterviewHref } from "@/lib/interview-entry";
export const maxDuration = 60;

/**
 * The interview room. Same identity rules as the club workspace page: demo access
 * by cookie and allowlisted email, otherwise the current user's membership. The
 * client checks the review permission before loading any candidate; the server
 * actions behind it enforce it again.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clubId } = await params, query = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  const jar = await cookies();
  let demoEnabled = false;
  if (!jar.has(PLATFORM_VIEW_COOKIE) && jar.get(DEMO_COOKIE)?.value === "1") {
    const { data: { user }, error } = await getSessionUser();
    demoEnabled = canAccessDemo(error ? undefined : user?.email);
  }
  const user = demoEnabled ? null : await getCurrentUser();
  if (!demoEnabled && !user) redirect(`/login?next=${encodeURIComponent(clubInterviewHref(clubId, search.toString()))}`);
  const membership = user?.memberships.find(member => member.clubId === clubId);
  if (membership?.club.suspendedAt) return <div className="space-y-4"><PageHeader title="This club is suspended" description={`${membership.club.name} operations are unavailable until an administrator restores the club. Your membership and existing records are preserved.`} /><Link className="underline" href="/home">Return to Personal workspace</Link></div>;
  return <AuthSessionBoundary><ClubInterviewRoom clubId={clubId} /></AuthSessionBoundary>;
}
