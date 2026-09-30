"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { canLeaveWorkspace } from "@/lib/product-navigation";
import { hasWorkspace } from "@/lib/permissions";
import { clubWorkspaceHref } from "@/lib/club-workspace";
export function ClubWorkspaceSwitcher({ clubId = "", managersOnly = false }: { clubId?: string; managersOnly?: boolean }) {
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
          if (!canLeaveWorkspace()) return;
          const id = e.target.value;
          if (!id) {
            router.push("/?workspace=student");
            return;
          }
          router.push(clubWorkspaceHref(id));
        }}
      >
        <option value="">
          Personal · {user.profile?.firstName || "Student"}
        </option>
        {user.memberships.filter(m => !managersOnly || hasWorkspace(m)).map((m) => (
          <option key={m.id} value={m.clubId}>
            {m.club.name} — {hasWorkspace(m) ? "Leader" : "Member"}
          </option>
        ))}
      </select>
    </label>
  );
}
