"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { hasWorkspace } from "@/lib/permissions";
import { clubWorkspaceHref } from "@/lib/club-workspace";
export function ClubWorkspaceSwitcher({ clubId = "" }: { clubId?: string }) {
  const { user } = useAuth(),
    router = useRouter();
  if (!user) return null;
  return (
    <label className="block min-w-0 text-xs text-muted-foreground">
      Workspace
      <select
        aria-label="Switch workspace"
        value={clubId}
        className="mt-1 min-h-11 w-full max-w-full rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            router.push("/?workspace=student");
            return;
          }
          router.push(clubWorkspaceHref(id));
        }}
      >
        <option value="">
          {user.profile?.firstName || "Personal"} — Student
        </option>
        {user.memberships.map((m) => (
          <option key={m.id} value={m.clubId}>
            {m.club.name} — {hasWorkspace(m) ? "Leader" : "Member"}
          </option>
        ))}
      </select>
    </label>
  );
}
