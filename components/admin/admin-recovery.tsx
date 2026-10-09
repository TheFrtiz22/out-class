import Link from "next/link";
export function AdminRecovery({ supportCode }: { supportCode: string }) {
  return <main className="space-y-4 p-8" role="alert"><h1>Admin temporarily unavailable</h1><p>We could not complete this request. Try again or contact support with this code.</p><p>Support code: <code>{supportCode}</code></p><Link href="/platform">Try Admin again</Link></main>;
}
