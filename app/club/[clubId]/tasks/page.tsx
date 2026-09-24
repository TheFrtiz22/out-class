import { ClubTasks } from "@/components/club-tasks";
export default async function Page({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <ClubTasks key={clubId} clubId={clubId} />
    </main>
  );
}
