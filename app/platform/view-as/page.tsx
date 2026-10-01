import { platformViewSession } from "@/utils/platform-view-as";
import { redirect } from "next/navigation";
export default async function Page() {
  const session = await platformViewSession().catch(() => null);
  if (!session) return <main className="p-8">This support session is unavailable. Use Exit impersonation above to return to your administrator account.</main>;
  redirect(session.clubId ? `/club/${encodeURIComponent(session.clubId)}/workspace` : "/?workspace=student");
}
