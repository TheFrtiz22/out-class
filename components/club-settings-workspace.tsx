"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { availableSettings } from "@/lib/club-settings";
import { canLeaveWorkspace } from "@/lib/product-navigation";
import { hasPermission } from "@/lib/permissions";
import { saveClubPreferences } from "@/actions/club-settings";
import { ClubProfileSettings } from "@/components/club-profile-settings";
import { Button } from "@/components/ui/button";
import "@/components/clubs/club-settings.css";
const ApplicationBuilder = dynamic(() =>
  import("@/components/views/club-manager/application-builder-view").then(
    (m) => m.ApplicationBuilderView,
  ),
);
const PipelineBuilder = dynamic(() =>
  import(
    "@/components/views/club-manager/interview-pipeline-builder-view"
  ).then((m) => m.InterviewPipelineBuilderView),
);
const Members = dynamic(() =>
  import("@/components/club-members").then((m) => m.ClubMembers),
);
const Interviews = dynamic(() =>
  import("@/components/interview-management-tabs").then(
    (m) => m.InterviewManagementTabs,
  ),
);
const EmailControls = dynamic(() =>
  import("@/components/invitation-email-controls").then(
    (m) => m.InvitationEmailControls,
  ),
);
export function ClubSettingsWorkspace({
  clubId,
  onSaved,
}: {
  clubId: string;
  onSaved?: () => void;
}) {
  const params = useSearchParams(),
    { user, refreshUser } = useAuth(),
    demo = useDemoMode(),
    member = user?.memberships.find((m) => m.clubId === clubId);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [visited, setVisited] = useState<string[]>([]);
  const [pipelineRevision, setPipelineRevision] = useState(0);
  const sections = member ? availableSettings(member) : [],
    active =
      sections.find((s) => s.id === params.get("setting"))?.id ||
      sections[0]?.id;
  useEffect(() => {
    if (active)
      setVisited((items) =>
        items.includes(active) ? items : [...items, active],
      );
  }, [active]);
  const visible = (id: string) =>
    sections.some((s) => s.id === id) &&
    (active === id || visited.includes(id));
  if (!member) return <p role="alert">Settings access unavailable.</p>;
  async function preference(fields: {
    isDiscoverable?: boolean;
    invitationEmailEnabled?: boolean;
  }) {
    setBusy(true);
    setError("");
    try {
      await saveClubPreferences({ clubId, ...fields });
      setNotice("Preference saved.");
      await refreshUser();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save preference.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="oc-settings-workspace">
      <nav
        className="oc-settings-navigation"
        aria-label="Club settings sections"
      >
        {sections.map((s) => (
          <Link
            key={s.id}
            href={`/club/${clubId}/workspace?section=settings&setting=${s.id}`}
            prefetch={false}
            aria-current={active === s.id ? "page" : undefined}
            onClick={(e) => {
              if (active === s.id) {
                e.preventDefault();
                return;
              }
              const discard = !!document.querySelector('[data-unsaved="true"]');
              if (!canLeaveWorkspace()) e.preventDefault();
              else {
                if (discard)
                  setVisited((items) => items.filter((id) => id !== active));
                setError("");
                setNotice("");
                if (
                  !e.metaKey &&
                  !e.ctrlKey &&
                  !e.shiftKey &&
                  !e.altKey &&
                  e.button === 0
                ) {
                  e.preventDefault();
                  window.history.pushState(
                    null,
                    "",
                    `/club/${clubId}/workspace?section=settings&setting=${s.id}`,
                  );
                }
              }
            }}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0" data-saving={busy}>
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-4 text-sm">
            {notice}
          </p>
        )}
        {visible("general") && (
          <div hidden={active !== "general"}>
            <ClubProfileSettings clubId={clubId} onSaved={onSaved} />
            {!demo.isDemoEnabled && (
              <section className="mt-6 border-t pt-5">
                <h2 className="oc-section-heading">Profile visibility</h2>
                <label className="mt-3 inline-flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={member.club.isDiscoverable !== false}
                    onChange={(e) =>
                      void preference({ isDiscoverable: e.target.checked })
                    }
                  />
                  Show this club in Discover
                </label>
                <p className="text-xs text-muted-foreground">
                  Your public profile remains accessible by its direct link.
                </p>
              </section>
            )}
          </div>
        )}
        {visible("application") && (
          <div hidden={active !== "application"}>
            <ApplicationBuilder clubId={clubId} />
          </div>
        )}
        {visible("pipeline") && (
          <div hidden={active !== "pipeline"}>
            <PipelineBuilder
              clubId={clubId}
              onSaved={() => setPipelineRevision((n) => n + 1)}
            />
          </div>
        )}
        {visible("interviews") && (
          <div hidden={active !== "interviews"} className="space-y-5">
            <h2 className="oc-section-heading">Interview Setup</h2>
            <p className="text-sm text-muted-foreground">
              Kits and booking rooms belong to recruiting rounds. Rooms include
              duration, location, capacity, and interviewer panels.
            </p>
            <Interviews
              key={pipelineRevision}
              clubId={clubId}
              initialTab="kits"
            />
          </div>
        )}
        {visible("members") && (
          <div hidden={active !== "members"}>
            <Members clubId={clubId} />
          </div>
        )}
        {visible("notifications") && (
          <div hidden={active !== "notifications"} className="space-y-5">
            <h2 className="oc-section-heading">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Invitation emails are requested explicitly and delivered in the
              background. Application review and decision changes are saved
              without sending automatic emails.
            </p>
            {!demo.isDemoEnabled && (
              <>
                {hasPermission(member, "club.settings") && (
                  <label className="inline-flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={member.club.invitationEmailEnabled !== false}
                      disabled={busy}
                      onChange={(e) =>
                        void preference({
                          invitationEmailEnabled: e.target.checked,
                        })
                      }
                    />
                    Allow member invitation emails
                  </label>
                )}
                <EmailControls clubId={clubId} />
              </>
            )}
          </div>
        )}
        {visible("advanced") && (
          <div hidden={active !== "advanced"} className="space-y-5">
            <h2 className="oc-section-heading">Ownership & administration</h2>
            <p className="text-sm text-muted-foreground">
              {member.club.claimedAt
                ? "This club has claimed its OutClass profile."
                : "This club has not yet completed its ownership claim."}
            </p>
            <p className="text-sm text-muted-foreground">
              Owners control all settings. Ownership transfer is available in a
              current member’s details and retains membership history. The last
              active owner is protected.
            </p>
            {member.isOwner && (
              <Link
                className="oc-profile-link"
                href={`/club/${clubId}/workspace?section=settings&setting=members`}
              >
                Manage owners and member access ↗
              </Link>
            )}
            {!member.club.claimedAt && (
              <Link className="oc-profile-link" href={`/club-claims/${clubId}`}>
                View claim process ↗
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
