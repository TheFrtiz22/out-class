import Link from "next/link";
import { MeetingList } from "@/components/meeting-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const { clubId } = await searchParams;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <Link className="text-sm underline" href="/">
        Back to OutClass
      </Link>
      <MeetingList clubId={clubId} />
    </main>
  );
}
