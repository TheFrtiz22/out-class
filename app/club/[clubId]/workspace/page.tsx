import { cookies } from "next/headers";
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { getSessionUser } from "@/utils/auth";
import { getCurrentUser } from "@/utils/current-user";
import Link from "next/link";
import { ClubWorkspace } from "@/components/club-workspace";
import { AuthSessionBoundary } from "@/components/auth-session-boundary";
export const maxDuration = 60;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ section?: string; taskView?: string; tool?: string }>;
}) {
  const { clubId } = await params,
    { section, taskView, tool } = await searchParams;
  const jar = await cookies();
  let demoEnabled = false;
  if (!jar.has(PLATFORM_VIEW_COOKIE) && jar.get(DEMO_COOKIE)?.value === "1") {
    const { data: { user }, error } = await getSessionUser();
    demoEnabled = canAccessDemo(error ? undefined : user?.email);
  }
  const user = demoEnabled ? null : await getCurrentUser();
  const membership = user?.memberships.find(member => member.clubId === clubId);
  if (membership?.club.suspendedAt) return <main className="mx-auto max-w-2xl space-y-4 p-8"><h1 className="font-serif text-3xl">This club is suspended</h1><p>{membership.club.name} operations are unavailable until an administrator restores the club. Your membership and existing records are preserved.</p><Link className="underline" href="/?workspace=student">Return to Personal workspace</Link></main>;
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
