import Link from "next/link";
export function AdminRecovery({ supportCode }: { supportCode: string }) {
  return <section className="oc-feedback oc-workspace-stack" role="alert"><h1 className="oc-page-title">Admin temporarily unavailable</h1><p>We could not complete this request. Try again or contact support with this code.</p><p>Support code: <code>{supportCode}</code></p><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/platform">Try Admin again</Link></section>;
}
