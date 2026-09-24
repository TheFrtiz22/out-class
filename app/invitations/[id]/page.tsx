import { InvitationResponse } from "@/components/invitation-response";
import { prisma } from "@/utils/prisma";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/utils/auth";
import { redirect } from "next/navigation";
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
  const { user: person } = await requireAuth();
  const invitation = await prisma.clubInvitation.findFirst({
    where: {
      id,
      email: person.email.toLowerCase(),
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
        <a className="underline" href="/">
          Return to OutClass
        </a>
      </main>
    );
  return (
    <main className="mx-auto max-w-lg space-y-6 p-8">
      <h1 className="font-display text-3xl">Join {invitation.club.name}</h1>
      <p>
        Accept with the UVA account this invitation was sent to. Your personal
        profile and existing memberships stay intact.
      </p>
      <p>
        Requested capabilities:{" "}
        {invitation.permissions.join(", ") || "Club membership"}
      </p>
      <InvitationResponse id={id} />
    </main>
  );
}
