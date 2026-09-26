import Link from "next/link";
import { requireAuth } from "@/utils/auth";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/utils/prisma";
import { ClaimForm } from "@/components/claim-form";
export default async function Page({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const client = await createClient(await cookies());
  const {
    data: { user: session },
  } = await client.auth.getUser();
  if (!session)
    redirect(`/?next=${encodeURIComponent(`/club-claims/${clubId}`)}`);
  const { user } = await requireAuth();
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true, name: true, claimedAt: true },
  });
  if (!club) notFound();
  const claim = await prisma.clubClaim.findFirst({
    where: { clubId, userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-5 py-12">
      <Link className="underline" href="/">
        Back to OutClass
      </Link>
      <h1 className="font-display text-3xl">Claim {club.name}</h1>
      <p>
        Keep your student identity. Once an OutClass administrator approves your
        request, this club’s workspace will become available to you.
      </p>
      {claim && (
        <p role="status">Your latest request: {claim.status.toLowerCase()}.</p>
      )}
      {club.claimedAt ? (
        <p>This club is managed. Ask an existing manager for an invitation.</p>
      ) : claim?.status === "PENDING" ? (
        <p>
          Your evidence is awaiting manual review. No management access has been
          granted.
        </p>
      ) : (
        <ClaimForm clubId={clubId} />
      )}
    </main>
  );
}
