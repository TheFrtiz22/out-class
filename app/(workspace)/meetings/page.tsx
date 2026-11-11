import { MeetingList } from "@/components/meeting-workspace";
export const metadata = { title: "Meetings", robots: { index: false, follow: false } }
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const { clubId } = await searchParams;
  return (
    <div className="max-w-[var(--oc-content-width)] space-y-6">
      <MeetingList clubId={clubId} />
    </div>
  );
}
