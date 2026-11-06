"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SavedClubsView } from "@/components/views/saved-clubs-view";
import { studentPath } from "@/lib/navigation"
export default function Page() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[var(--oc-content-width)]">
      <Link
        href="/corkboard"
        className="mb-6 inline-flex min-h-11 items-center text-sm underline"
      >
        Campus Corkboard
      </Link>
      <SavedClubsView
        onNavigate={(view) => router.push(studentPath(view))}
      />
    </div>
  );
}
