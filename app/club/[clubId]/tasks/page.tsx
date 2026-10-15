import { ClubTasks } from "@/components/club-tasks";
export default async function Page({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  return (
    <main data-workspace-detail className="mx-auto min-h-screen max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <ClubTasks key={clubId} clubId={clubId} initialScope="team" />
    </main>
  );
}
