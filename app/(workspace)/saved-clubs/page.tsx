"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SavedClubsView } from "@/components/views/saved-clubs-view";
import { studentPath } from "@/lib/navigation"
export default function Page() {
  const router = useRouter();
  return (
    <div className="max-w-[var(--oc-content-width)]">
      <SavedClubsView
        onNavigate={(view) => router.push(studentPath(view))}
        headerAction={<Link href="/explore" className="text-sm underline underline-offset-4">Explore clubs</Link>}
      />
    </div>
  );
}
