import Link from "next/link";
import { CorkboardView } from "@/components/views/corkboard-view";
export const metadata = { title: "Corkboard · Campus events" };
export default function Page() {
  return (
    <main data-workspace-detail className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <Link
        className="mb-6 inline-flex min-h-11 items-center text-sm underline"
        href="/?workspace=student"
      >
        OutClass workspace
      </Link>
      <CorkboardView />
    </main>
  );
}
