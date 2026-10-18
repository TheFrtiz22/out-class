import { MeetingList } from "@/components/meeting-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const { clubId } = await searchParams;
  return (
    <div className="max-w-4xl space-y-6">
      <MeetingList clubId={clubId} />
    </div>
  );
}
