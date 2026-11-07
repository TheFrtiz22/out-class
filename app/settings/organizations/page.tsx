import Link from "next/link";
import { OrganizationMemberships } from "@/components/organization-memberships";
import { requireAuth } from "@/utils/auth";
import { OrganizationOwnershipRequests } from "@/components/organization-ownership-requests";
import { requireCompletedStudentProfile } from "@/utils/profile-onboarding";

export const metadata = { title: "Clubs" }

export default async function OrganizationSettings() {
  const { user } = await requireAuth({ verifyEmail: true });
  await requireCompletedStudentProfile(user.id, "/settings/organizations");
  return <div className="space-y-8">
    <p className="text-sm leading-6 text-muted-foreground">Setting a request aside doesn’t decline it. Accept an invitation, claim a club, or show a hidden request on your dashboard again.</p>
    <OrganizationMemberships />
    <OrganizationOwnershipRequests enabled includeDismissed />
    <section className="space-y-3 border-t pt-5" aria-label="Request club access"><h2 className="oc-section-heading">Find or claim a club</h2><p className="text-sm leading-6 text-muted-foreground">Find your club in Explore. Unclaimed profiles include a request form for club leaders; managed clubs can invite you to join.</p><Link href="/explore" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Explore clubs</Link></section>
  </div>;
}
