import Link from "next/link";
import { MeetingDetail } from "@/components/meeting-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="max-w-[var(--oc-content-width)] space-y-6">
      <Link className="text-sm underline" href="/meetings">
        All meetings
      </Link>
      <MeetingDetail id={id} />
    </div>
  );
}
