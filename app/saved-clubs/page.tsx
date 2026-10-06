"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SavedClubsView } from "@/components/views/saved-clubs-view";
export default function Page() {
  const router = useRouter();
  return (
    <main data-workspace-detail className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <Link
        href="/corkboard"
        className="mb-6 inline-flex min-h-11 items-center text-sm underline"
      >
        Campus Corkboard
      </Link>
      <SavedClubsView
        onNavigate={(view) => router.push(`/?workspace=student&view=${view}`)}
      />
    </main>
  );
}
