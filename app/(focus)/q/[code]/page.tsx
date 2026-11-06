import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveShortLink } from "@/lib/short-link-store";
import { prisma } from "@/utils/prisma";
import { PageHeader } from "@/components/product/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function ShortLinkRedirectPage({ params }: PageProps) {
  const { code } = await params;
  const result = await resolveShortLink(prisma, code);

  if (result.status === "valid" && result.target) {
    redirect(result.target);
  }

  // Branded, informative status for expired, revoked, or missing links. The focus frame carries the mark.
  const isExpired = result.status === "expired";
  const isRevoked = result.status === "revoked";

  const title = isExpired
    ? "Check-In Code Expired"
    : isRevoked
      ? "Check-In Closed"
      : "Link Not Found";

  const description =
    result.message ||
    (isExpired
      ? "This attendance code has expired. Check-in codes rotate regularly to protect attendance integrity. Please scan the current code displayed by the meeting leader."
      : isRevoked
        ? "This check-in session has been closed by the host. Attendance is no longer being accepted for this session."
        : "The QR code you scanned is not recognized or has been removed.");

  return (
    <section className="oc-content-panel space-y-6 text-center">
      <Badge variant={isExpired ? "warning" : isRevoked ? "destructive" : "secondary"}>
        {isExpired ? "Expired Code" : isRevoked ? "Closed" : "Unavailable"}
      </Badge>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col gap-3">
        <Button asChild><Link href="/meetings">View Club Meetings</Link></Button>
        <Button asChild variant="outline"><Link href="/">Return to OutClass</Link></Button>
      </div>
    </section>
  );
}
