import Link from "next/link";
import { OrganizationMemberships } from "@/components/organization-memberships";
import { requireAuth } from "@/utils/auth";
import { OrganizationOwnershipRequests } from "@/components/organization-ownership-requests";
import { requireCompletedStudentProfile } from "@/utils/profile-onboarding";

export default async function OrganizationSettings() {
  const { user } = await requireAuth({ verifyEmail: true });
  await requireCompletedStudentProfile(user.id, "/settings/organizations");
  return <div className="space-y-8">
    <p className="text-sm leading-6 text-muted-foreground">Setting a request aside doesn’t decline it. Accept an invitation, claim an organization, or show a hidden request on your dashboard again.</p>
    <OrganizationMemberships />
    <OrganizationOwnershipRequests enabled includeDismissed />
    <section className="space-y-3 border-t pt-5" aria-label="Request organization access"><h2 className="oc-section-heading">Find or claim an organization</h2><p className="text-sm leading-6 text-muted-foreground">Find your organization in Discover. Unclaimed profiles include a request form for organization leaders; managed organizations can invite you to join.</p><Link href="/?workspace=student&view=explore" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Explore organizations</Link></section>
  </div>;
}
