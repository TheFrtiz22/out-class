import { AdminAccessError } from "@/lib/admin-failure";
import { logAdminFailure } from "@/utils/admin-page";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import { platformViewSession } from "@/utils/platform-view-as";
import { redirect } from "next/navigation";
export default async function Page() {
  let session;
  try { session = await platformViewSession(); }
  catch (error) {
    const supportCode = logAdminFailure("/platform/view-as", error);
    if (!(error instanceof AdminAccessError)) return <AdminRecovery supportCode={supportCode} />;
  }
  if (!session) return <main className="p-8">This support session is unavailable. Use Exit impersonation above to return to your administrator account.</main>;
  redirect(session.clubId ? `/club/${encodeURIComponent(session.clubId)}/workspace` : "/?workspace=student");
}
