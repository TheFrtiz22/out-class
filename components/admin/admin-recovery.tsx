import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
export function AdminRecovery({ supportCode }: { supportCode: string }) {
  return <section className="oc-feedback oc-workspace-stack" role="alert"><PageHeader title="Admin temporarily unavailable" /><p>We could not complete this request. Try again or contact support with this code.</p><p>Support code: <code>{supportCode}</code></p><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/platform">Try Admin again</Link></section>;
}
