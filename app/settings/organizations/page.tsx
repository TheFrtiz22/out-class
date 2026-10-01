import Link from "next/link";
import { requireAuth } from "@/utils/auth";
import { OrganizationOwnershipRequests } from "@/components/organization-ownership-requests";
import { OutClassLogo } from "@/components/outclass-logo";

export default async function OrganizationSettings() {
  await requireAuth({ verifyEmail: true });
  return <main className="mx-auto min-h-svh max-w-5xl px-4 py-8 sm:px-8">
    <header className="mb-10 flex flex-wrap items-center justify-between gap-4"><Link href="/?workspace=student" aria-label="OutClass dashboard"><OutClassLogo className="h-7 w-auto" /></Link><Link href="/?workspace=student" className="min-h-11 inline-flex items-center text-sm underline underline-offset-4">Back to dashboard</Link></header>
    <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Settings → Organizations</p>
    <h1 className="mb-3 font-display text-3xl sm:text-4xl">Your organization requests</h1>
    <p className="mb-8 max-w-xl text-sm leading-7 text-muted-foreground">Setting a request aside doesn’t decline it. Accept an invitation here, claim an organization, or show a hidden request on your dashboard again.</p>
    <OrganizationOwnershipRequests enabled includeDismissed />
  </main>;
}
