import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveShortLink } from "@/actions/short-links";
import { BRAND_NAVY, BRAND_IVORY, OC_MONOGRAM_PATHS } from "@/lib/qr/constants";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function ShortLinkRedirectPage({ params }: PageProps) {
  const { code } = await params;
  const result = await resolveShortLink(code);

  if (result.status === "valid" && result.target) {
    redirect(result.target);
  }

  // Render branded, informative status screen for expired, revoked, or missing links
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
    <main className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        {/* OutClass Monogram Mark */}
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl" style={{ backgroundColor: BRAND_NAVY }}>
          <svg viewBox="0 0 180 180" className="size-10" fill="none">
            <g style={{ transform: "scale(95%)", transformOrigin: "center" }}>
              <path fill={BRAND_IVORY} d={OC_MONOGRAM_PATHS[0]} />
              <path fill={BRAND_IVORY} d={OC_MONOGRAM_PATHS[1]} />
            </g>
          </svg>
        </div>

        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
            isExpired
              ? "bg-amber-100 text-amber-900"
              : isRevoked
                ? "bg-rose-100 text-rose-900"
                : "bg-neutral-100 text-neutral-800"
          }`}
        >
          {isExpired ? "Expired Code" : isRevoked ? "Closed" : "Unavailable"}
        </span>

        <h1 className="oc-page-title mt-4 text-2xl font-bold tracking-tight text-neutral-900">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          {description}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/meetings"
            className="inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND_NAVY }}
          >
            View Club Meetings
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Return to OutClass
          </Link>
        </div>
      </div>
    </main>
  );
}
