import { CorkboardView } from "@/components/views/corkboard-view";
export const metadata = { title: "Corkboard · Campus events" };
export default function Page() {
  return (
    <div data-workspace-detail className="mx-auto max-w-7xl">
      <CorkboardView />
    </div>
  );
}
