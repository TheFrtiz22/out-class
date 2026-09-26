import { ClubWorkspace } from "@/components/club-workspace";
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
    <ClubWorkspace
      key={clubId}
      clubId={clubId}
      section={section ?? "overview"}
      taskView={taskView}
      tool={tool}
    />
  );
}
