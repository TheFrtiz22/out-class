import Link from "next/link";
import { PageHeader } from "@/components/product/page-header";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { redirect } from "next/navigation";
import { listClubClaims } from "@/actions/club-claims";
import { ClaimReview } from "@/components/claim-review";
export default async function Page() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/platform/login");
  }
  return (
    <main data-workspace-detail className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <Link className="underline" href="/platform">
        Platform administration
      </Link>
      <PageHeader eyebrow="OutClass · Administration" title="Club claims" />
      <ClaimReview initial={await listClubClaims("PENDING")} />
    </main>
  );
}
