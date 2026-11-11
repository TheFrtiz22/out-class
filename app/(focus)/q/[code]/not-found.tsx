import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"

export const metadata = { title: "Link unavailable" }

/** Unknown, expired or removed short link: one page, served with a 404 status. */
export default function ShortLinkNotFound() {
  return (
    <Panel as="section" className="space-y-6 text-center">
      <PageHeader title="This link is unavailable" description="It may have expired, been typed incorrectly or been removed. If you scanned it at a meeting, scan the code the host is showing now." />
      <div className="flex flex-col gap-3">
        <Button asChild><Link href="/">Go to OutClass home</Link></Button>
        <Button asChild variant="outline"><Link href="/login">Sign in</Link></Button>
      </div>
    </Panel>
  )
}
