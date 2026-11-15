import Link from "next/link";
import { MeetingDetail } from "@/components/meeting-workspace";
export const metadata = { title: "Meeting", robots: { index: false, follow: false } }
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="max-w-[var(--oc-content-width)] space-y-6">
      <MeetingDetail id={id} headerAction={<Link className="text-sm underline underline-offset-4" href="/meetings">All meetings</Link>} />
    </div>
  );
}
