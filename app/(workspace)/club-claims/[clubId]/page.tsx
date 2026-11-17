import Link from "next/link";
import { requireAuth } from "@/utils/auth";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/utils/prisma";
import { ClaimForm } from "@/components/claim-form";
import { PageHeader } from "@/components/ui/page-header";
import { SignInCard } from "@/components/landing/sign-in-card";
import { clubLinkPreview } from "@/lib/public-link-preview";
import { clubWorkspaceHref } from "@/lib/club-workspace";

export const metadata = { title: "Claim a club", robots: { index: false, follow: false } }
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
  if (!session) {
    const next = `/club-claims/${encodeURIComponent(clubId)}`;
    const club = await clubLinkPreview(clubId);
    return club ? (
      <SignInCard eyebrow="Club leaders" title={<>Claim {club.name} on OutClass</>} next={next}>
        <p>Sign in with your UVA account to request management of this club. An OutClass administrator reviews every request before any access is granted.</p>
      </SignInCard>
    ) : (
      <SignInCard invalid title="This club link isn’t valid" next={next}><p>The club may have moved or is no longer listed.</p></SignInCard>
    );
  }
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
  // One status line per state: the request's outcome and what to do next, never the raw code twice.
  const approved = claim?.status === "APPROVED" && !!club.claimedAt;
  const status = approved
    ? "Your request was approved. This club’s workspace is now yours."
    : club.claimedAt
      ? "This club is already managed on OutClass. Ask one of its leaders for an invitation."
      : claim?.status === "PENDING"
        ? "Your request is pending review. No management access is granted until an administrator approves it."
        : claim?.status === "REJECTED"
          ? "Your last request wasn’t approved. You can send a new one with more evidence."
          : null;
  return (
    <div className="max-w-[var(--oc-reading-width)] space-y-6">
      <PageHeader
        title={<>Claim {club.name}</>}
        description="Keep your student account. Once an OutClass administrator approves your request, this club’s workspace opens to you."
        action={<Link className="underline underline-offset-4" href="/clubs">My Clubs</Link>}
      />
      {status && <p role="status" className="text-sm">{status}</p>}
      {approved ? (
        <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={clubWorkspaceHref(club.id)}>Open the club workspace</Link>
      ) : !club.claimedAt && claim?.status !== "PENDING" ? (
        <ClaimForm clubId={clubId} />
      ) : null}
    </div>
  );
}
