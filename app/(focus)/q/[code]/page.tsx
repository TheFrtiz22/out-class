import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveShortLink } from "@/lib/short-link-store";
import { prisma } from "@/utils/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function ShortLinkRedirectPage({ params }: PageProps) {
  const { code } = await params;
  const result = await resolveShortLink(prisma, code);

  if (result.status === "valid" && result.target) {
    redirect(result.target);
  }

  // Unknown codes are a real 404 (./not-found.tsx). Known but expired or closed codes explain why.
  if (result.status !== "expired" && result.status !== "revoked") notFound();
  const isExpired = result.status === "expired";
  const title = isExpired ? "This check-in code has expired" : "Check-in is closed";
  const description =
    result.message ||
    (isExpired
      ? "Check-in codes change regularly. Scan the code the meeting host is showing now."
      : "The host closed this check-in, so attendance is no longer being recorded.");

  return (
    <Panel as="section" className="space-y-6 text-center">
      <Badge variant={isExpired ? "warning" : "destructive"}>{isExpired ? "Expired code" : "Closed"}</Badge>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col gap-3">
        <Button asChild><Link href="/meetings">View club meetings</Link></Button>
        <Button asChild variant="outline"><Link href="/">Go to OutClass home</Link></Button>
      </div>
    </Panel>
  );
}
