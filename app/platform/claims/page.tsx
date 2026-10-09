import { adminPageLoad } from "@/utils/admin-page";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import Link from "next/link";
import { PageHeader } from "@/components/product/page-header";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { listClubClaims } from "@/actions/club-claims";
import { ClaimReview } from "@/components/claim-review";
export default async function Page() {
  const result = await adminPageLoad("/platform/claims", requirePlatformAdmin);
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  const claims = await adminPageLoad("/platform/claims", () => listClubClaims("PENDING"), "ADMIN_DATA_LOAD_FAILED");
  if (claims.supportCode) return <AdminRecovery supportCode={claims.supportCode} />;
  return (
    <main data-workspace-detail className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <Link className="underline" href="/platform">
        Platform administration
      </Link>
      <PageHeader eyebrow="OutClass · Administration" title="Club claims" />
      <ClaimReview initial={claims.value!} />
    </main>
  );
}
