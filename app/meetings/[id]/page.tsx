import { MeetingDetail } from "@/components/meeting-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <a className="text-sm underline" href="/meetings">
        All meetings
      </a>
      <MeetingDetail id={id} />
    </main>
  );
}
