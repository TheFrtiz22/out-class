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
