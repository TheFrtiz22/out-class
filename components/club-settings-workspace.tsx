"use client";

import { ArrowUpRight } from "@/components/icons"
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { resolveSettingsTab, settingsSections } from "@/lib/club-settings";
import { navigateWithinClub } from "@/lib/workspace-navigation";
import { canLeaveWorkspace } from "@/lib/product-navigation";
import { hasPermission } from "@/lib/permissions";
import { saveClubPreferences } from "@/actions/club-settings";
import { ClubProfileSettings } from "@/components/club-profile-settings";

import "@/components/clubs/club-settings.css";
const ApplicationBuilder = dynamic(() =>
  import("@/components/views/club-manager/application-builder-view").then(
    (m) => m.ApplicationBuilderView,
  ),
);
const DecisionTemplates = dynamic(() => import("@/components/communications/template-editor").then(m => m.DecisionTemplateEditor));
const Cycles = dynamic(() => import("@/components/recruitment-cycles").then(m => m.RecruitmentCycles));
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
export function ClubSettingsWorkspace({
  clubId,
  onSaved,
}: {
  clubId: string;
  onSaved?: () => void;
}) {
  const params = useSearchParams(), router = useRouter(),
    { user, refreshUser } = useAuth(),
    demo = useDemoMode(),
    member = user?.memberships.find((m) => m.clubId === clubId);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [visited, setVisited] = useState<string[]>([]);
  const [pipelineRevision, setPipelineRevision] = useState(0);
  const { sections, active } = resolveSettingsTab(member, params.get("setting"));
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
  const requested = params.get("setting");
  if (requested && settingsSections.some(section => section.id === requested) && !sections.some(section => section.id === requested)) return <p role="alert">This settings section isn’t available with your current access.</p>;
  function selectSetting(id: string) {
    if (active === id) return;
    const discard = !!document.querySelector('[data-unsaved="true"]');
    if (!canLeaveWorkspace()) return;
    if (discard) setVisited(items => items.filter(item => item !== active));
    setError(""); setNotice("");
    const href = `/club/${encodeURIComponent(clubId)}/workspace?section=settings&setting=${id}`;
    if (!navigateWithinClub(href)) router.push(href);
  }
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
      <aside className="oc-settings-menu">
      <label className="oc-settings-mobile-selector text-sm" htmlFor="organization-settings-section">Organization settings
        <select id="organization-settings-section" aria-label="Organization settings" className="oc-settings-select" value={active ?? ""} onChange={event => selectSetting(event.target.value)}>
          {sections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}
        </select>
      </label>
      <nav
        className="oc-settings-navigation oc-settings-desktop-navigation"
        aria-label="Settings sections"
      >
        <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Organization settings</p>
        {sections.map((s) => (
          <Link
            key={s.id}
            href={`/club/${clubId}/workspace?section=settings&setting=${s.id}`}
            prefetch={false}
            aria-current={active === s.id ? "page" : undefined}
            onClick={event => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault(); selectSetting(s.id);
            }}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <Link href="/settings" className="mt-5 inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground underline underline-offset-4" onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>Personal settings</Link>
      </aside>
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
            {hasPermission(member, "recruitment.manage") && <div className="mb-5 flex flex-wrap gap-4 border-b pb-4 text-sm"><Link className="underline underline-offset-4" href={`/club/${clubId}/workspace?section=settings&setting=pipeline`} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>Configure recruitment rounds</Link><Link className="underline underline-offset-4" href={`/club/${clubId}/workspace?section=settings&setting=cycles`} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>Manage application cycles</Link></div>}
            <ApplicationBuilder clubId={clubId} />
          </div>
        )}
        {visible("cycles") && <div hidden={active !== "cycles"}><Cycles clubId={clubId} /></div>}
        {visible("pipeline") && (
          <div hidden={active !== "pipeline"}>
            <PipelineBuilder
              clubId={clubId}
              onSaved={() => { setPipelineRevision((n) => n + 1); onSaved?.() }}
            />
          </div>
        )}
        {visible("interviews") && (
          <div hidden={active !== "interviews"} className="space-y-5">
            <h2 className="oc-section-heading">Interview configuration</h2>
            <p className="text-sm text-muted-foreground">
              Configure evaluation kits and interview access for your recruitment rounds. Manage rooms, panels, and upcoming bookings in Interview Scheduling.
            </p>
            <Interviews
              key={`${pipelineRevision}:${params.get("interviewTab") || "kits"}:${params.get("roundId") || ""}`}
              clubId={clubId}
              settingsOnly
              initialTab={params.get("interviewTab") || "kits"}
              initialRoundId={params.get("roundId") || undefined}
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
            <h2 className="oc-section-heading">Communications</h2>
            <p className="text-sm text-muted-foreground">
              Invitation emails are requested explicitly and delivered in the
              background. Application review and decision changes are saved
              without sending automatic emails.
            </p>
            {!demo.isDemoEnabled && (
              <>
                {hasPermission(member, "recruitment.manage") && <DecisionTemplates clubId={clubId} />}
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
                {(hasPermission(member, "members.manage") || hasPermission(member, "leaders.manage")) && <Link href={`/club/${encodeURIComponent(clubId)}/workspace?section=members`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>Manage invitation delivery and schedules</Link>}
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
                Manage owners and member access <ArrowUpRight size={14} className="inline-block align-text-bottom" />
              </Link>
            )}
            {!member.club.claimedAt && (
              <Link className="oc-profile-link" href={`/club-claims/${clubId}`}>
                View claim process <ArrowUpRight size={14} className="inline-block align-text-bottom" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
