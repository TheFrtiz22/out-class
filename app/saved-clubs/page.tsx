"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SavedClubsView } from "@/components/views/saved-clubs-view";
export default function Page() {
  const router = useRouter();
  return (
    <div data-workspace-detail className="mx-auto max-w-6xl">
      <Link
        href="/corkboard"
        className="mb-6 inline-flex min-h-11 items-center text-sm underline"
      >
        Campus Corkboard
      </Link>
      <SavedClubsView
        onNavigate={(view) => router.push(`/?workspace=student&view=${view}`)}
      />
    </div>
  );
}
