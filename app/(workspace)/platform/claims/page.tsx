import { adminPageLoad } from "@/utils/admin-page";
import { AdminRecovery } from "@/components/admin/admin-recovery";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { listClubClaims } from "@/actions/club-claims";
import { ClaimReview } from "@/components/claim-review";
export default async function Page() {
  const result = await adminPageLoad("/platform/claims", requirePlatformAdmin);
  if (result.supportCode) return <AdminRecovery supportCode={result.supportCode} />;
  const claims = await adminPageLoad("/platform/claims", () => listClubClaims("PENDING"), "ADMIN_DATA_LOAD_FAILED");
  if (claims.supportCode) return <AdminRecovery supportCode={claims.supportCode} />;
  return (
    <section className="max-w-[var(--oc-content-width)] space-y-6">
      <PageHeader eyebrow="OutClass · Administration" title="Club claims" action={<Link className="underline underline-offset-4" href="/platform">Platform administration</Link>} />
      <ClaimReview initial={claims.value!} />
    </section>
  );
}
