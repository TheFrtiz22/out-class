import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveShortLink } from "@/lib/short-link-store";
import { prisma } from "@/utils/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export const metadata = { title: "Check-in link", robots: { index: false, follow: false } }

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function ShortLinkRedirectPage({ params }: PageProps) {
  const { code } = await params;
  const result = await resolveShortLink(prisma, code);

  if (result.status === "valid" && result.target) {
    redirect(result.target);
  }

  // Unknown and expired codes share one "link unavailable" 404 (./not-found.tsx).
  // Only a check-in the host closed explains itself (docs/qr-attendance.md).
  if (result.status !== "revoked") notFound();
  const title = "Check-in is closed";
  const description =
    result.message || "The host closed this check-in, so attendance is no longer being recorded.";

  return (
    <Panel as="section" className="space-y-6 text-center">
      <Badge variant="destructive">Closed</Badge>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col gap-3">
        <Button asChild><Link href="/meetings">View club meetings</Link></Button>
        <Button asChild variant="outline"><Link href="/">Go to OutClass home</Link></Button>
      </div>
    </Panel>
  );
}
