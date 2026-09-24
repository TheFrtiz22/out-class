import { MeetingList } from "@/components/meeting-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const { clubId } = await searchParams;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <a className="text-sm underline" href="/">
        Back to OutClass
      </a>
      <MeetingList clubId={clubId} />
    </main>
  );
}
