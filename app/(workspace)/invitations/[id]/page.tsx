import { permissionLabels, type ClubPermission } from "@/lib/permissions";
import Link from "next/link";
import { InvitationResponse } from "@/components/invitation-response";
import { prisma } from "@/utils/prisma";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/utils/auth";
import { clubWriteTransaction } from "@/utils/club-write-transaction";
import { verifiedSchoolIdentities, prepareVerifiedSchoolAccount } from "@/utils/school-identity";
import { UniversityVerificationError } from "@/utils/verified-email-policy";
import { requireCompletedStudentProfile } from "@/utils/profile-onboarding";
import { PageHeader } from "@/components/ui/page-header";
import { SignInCard } from "@/components/landing/sign-in-card";
import { invitationPreview } from "@/lib/public-link-preview";

export const metadata = { title: "Club invitation", robots: { index: false, follow: false } }
export default async function Invitation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await createClient(await cookies());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    // Signed out: say what this is and return here after sign-in. Acceptance below still
    // re-verifies the signed-in identity against the invitation; the link alone grants nothing.
    const next = `/invitations/${encodeURIComponent(id)}`;
    const preview = await invitationPreview(id);
    return preview ? (
      <SignInCard eyebrow="Club invitation" title={<>You’ve been invited to join {preview.clubName} as {preview.owner ? "its owner" : `${/^[AEIOU]/.test(preview.role) ? "an" : "a"} ${preview.role.toLowerCase()}`}</>} next={next}>
        <p>Sign in with the UVA email address this invitation was sent to, or create your account with it.</p>
      </SignInCard>
    ) : (
      <SignInCard invalid title="This invitation link isn’t valid" next={next}>
        <p>It may have expired, been withdrawn or already been answered. Ask the club for a new invitation, or sign in to see invitations sent to you.</p>
      </SignInCard>
    );
  }
  const account = await requireAuth({ verifyEmail: true });
  const person = account.user;
  await requireCompletedStudentProfile(person.id, `/invitations/${id}`);
  let verificationError: UniversityVerificationError | undefined;
  const identities = await (async () => {
    try {
      await prepareVerifiedSchoolAccount(account);
      return await clubWriteTransaction(tx => verifiedSchoolIdentities(tx, account));
    } catch (error) {
      if (!(error instanceof UniversityVerificationError)) throw error;
      verificationError = error;
      return [];
    }
  })();
  if (verificationError) return <div className="max-w-xl space-y-4">
    <PageHeader title={verificationError.code === "UNIVERSITY_VERIFICATION_REQUIRED" ? "Verify your university email" : "Invitation verification unavailable"} />
    <p role="alert">{verificationError.message}</p><Link className="underline" href="/settings/organizations">View organizations</Link>
  </div>;
  const invitation = await prisma.clubInvitation.findFirst({
    where: {
      id,
      OR: [
        { schoolIdentityId: null, email: person.email.toLowerCase() },
        { schoolIdentityId: { in: identities.map(identity => identity.id) } },
      ],
      status: "PENDING",
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { club: { select: { name: true } } },
  });
  if (!invitation)
    return (
      <div className="max-w-xl space-y-4">
      <PageHeader title="Invitation unavailable" />
        <p>
          This link may have expired or already been answered. Sign in with the
          invited UVA account, or ask the club manager for a new invitation.
        </p>
        <Link className="underline" href="/settings/organizations">
          View organizations
        </Link>
      </div>
    );
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title={<>{(invitation.schoolIdentityId && invitation.requestedRole === "OWNER") ? "Claim" : "Join"} {invitation.club.name}</>} />
      <p className="text-sm leading-7 text-muted-foreground">
        Accept with the UVA account this invitation was sent to. Your personal
        profile and existing memberships stay intact.
      </p>
      <div className="rounded-xl border oc-glass-surface p-4 sm:p-5"><h2 className="oc-section-heading ">Your organization access</h2><ul className="mt-3 flex flex-wrap gap-2">{(invitation.permissions.length ? invitation.permissions : ["membership"]).map(permission => <li key={permission} className="rounded-md bg-muted px-2.5 py-1.5 text-xs leading-5">{permissionLabels[permission as ClubPermission] || "Club membership"}</li>)}</ul></div>
      {(invitation.schoolIdentityId && invitation.requestedRole === "OWNER") && <p className="text-sm leading-7">You’ve been designated as an administrator. Claiming gives you owner access to manage members, roles, applications, recruiting, interviews, and organization settings.</p>}
      <InvitationResponse id={id} owner={!!invitation.schoolIdentityId && invitation.requestedRole === "OWNER"} />
    </div>
  );
}
