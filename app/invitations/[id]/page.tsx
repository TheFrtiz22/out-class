import Link from "next/link";
import { InvitationResponse } from "@/components/invitation-response";
import { prisma } from "@/utils/prisma";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/utils/auth";
import { redirect } from "next/navigation";
import { verifiedSchoolIdentities } from "@/utils/school-identity";
import { hasConfirmedUniversityEmail, requireVerifiedEmailPolicy } from "@/utils/verified-email-policy";
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
  if (!user) redirect(`/?next=${encodeURIComponent(`/invitations/${id}`)}`);
  const account = await requireAuth({ verifyEmail: true });
  const person = account.user;
  const verifiedEmail = hasConfirmedUniversityEmail(account) &&
    await requireVerifiedEmailPolicy().then(() => true).catch(() => false);
  // A delivery email is not identity proof. Legacy links retain their email binding.
  const identities = await prisma.$transaction(tx => verifiedSchoolIdentities(tx, account)).catch(() => []);
  const invitation = await prisma.clubInvitation.findFirst({
    where: {
      id,
      OR: [
        ...(verifiedEmail ? [{ schoolIdentityId: null, email: person.email.toLowerCase() }] : []),
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
      <main className="mx-auto max-w-lg space-y-4 p-8">
        <h1 className="font-display text-3xl">Invitation unavailable</h1>
        <p>
          This link may have expired or already been answered. Sign in with the
          invited UVA account, or ask the club manager for a new invitation.
        </p>
        <Link className="underline" href="/">
          Return to OutClass
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-lg space-y-6 p-8">
      <h1 className="font-display text-3xl">{(invitation.schoolIdentityId && invitation.requestedRole === "OWNER") ? "Claim" : "Join"} {invitation.club.name}</h1>
      <p>
        Accept with the UVA account this invitation was sent to. Your personal
        profile and existing memberships stay intact.
      </p>
      <p>
        Requested capabilities:{" "}
        {invitation.permissions.join(", ") || "Club membership"}
      </p>
      {(invitation.schoolIdentityId && invitation.requestedRole === "OWNER") && <p>You’ve been designated as an administrator. Claiming gives you owner access to manage members, roles, applications, recruiting, interviews, and organization settings.</p>}
      <InvitationResponse id={id} owner={!!invitation.schoolIdentityId && invitation.requestedRole === "OWNER"} />
    </main>
  );
}
