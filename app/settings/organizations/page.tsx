import { PageHeader } from "@/components/product/page-header";
import { onboardingFocus } from "@/lib/onboarding-presentation";
import { OrganizationMemberships } from "@/components/organization-memberships";
import Link from "next/link";
import { requireAuth } from "@/utils/auth";
import { OrganizationOwnershipRequests } from "@/components/organization-ownership-requests";
import { OutClassLogo } from "@/components/outclass-logo";
import { requireCompletedStudentProfile } from "@/utils/profile-onboarding";

export default async function OrganizationSettings() {
  const { user } = await requireAuth({ verifyEmail: true });
  await requireCompletedStudentProfile(user.id, "/settings/organizations");
  return <main data-workspace-detail className="mx-auto min-h-svh max-w-5xl px-4 py-8 sm:px-8">
    <header className="mb-10 flex flex-wrap items-center justify-between gap-4"><Link href="/?workspace=student" aria-label="OutClass dashboard"><OutClassLogo className="h-7 w-auto" /></Link><Link href="/?workspace=student" className={`min-h-11 inline-flex items-center text-sm underline underline-offset-4 ${onboardingFocus}`}>Back to dashboard</Link></header>
    <PageHeader eyebrow="Settings → Organizations" title="Organizations" description="Setting a request aside doesn’t decline it. Accept an invitation here, claim an organization, or show a hidden request on your dashboard again." illustration="jefferson" />
    <OrganizationMemberships />
    <OrganizationOwnershipRequests enabled includeDismissed />
  </main>;
}
