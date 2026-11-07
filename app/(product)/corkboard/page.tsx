import { CorkboardView } from "@/components/views/corkboard-view";
export const metadata = { title: "Corkboard · Campus events" };
export default function Page() {
  return (
    <div className="max-w-[var(--oc-content-width)]">
      <CorkboardView />
    </div>
  );
}
