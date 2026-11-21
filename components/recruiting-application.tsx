"use client";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoMode } from "@/contexts/demo-context";
import { hasPermission, type ClubAccess } from "@/lib/permissions";
import { canLeaveWorkspace } from "@/lib/product-navigation";
import { canOpenRecruitingSettings, recruitingSettingsSections, withRecruitingSettings } from "@/lib/recruiting-settings";
import { VotingRuleDefaults } from "@/components/live-voting/voting-rule-defaults";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import "@/components/clubs/club-settings.css";

const ApplicationBuilder = dynamic(() => import("@/components/views/club-manager/application-builder-view").then(m => m.ApplicationBuilderView),
  { loading: () => <LoadingState label="Loading application settings…" layout="form" rows={3} /> });

/**
 * Recruiting › Application (`tool=application`): the application form and deadline, the Recruiting settings drawer,
 * and default voting rules. This was Settings › Recruitment & applications; that URL redirects here
 * (lib/workspace-routes.ts). Rounds and cycles stay in Settings and are not linked again from this page.
 */
export function RecruitingApplication({ clubId, member }: { clubId: string; member: ClubAccess }) {
  const router = useRouter(), params = useSearchParams(), demo = useDemoMode();
  return <div className="oc-workspace-stack">
    {/* Recruiting: opens the Recruiting settings drawer in place (the same drawer as the Applicants gear). */}
    {canOpenRecruitingSettings(member) && <section aria-labelledby="recruiting-application-settings-heading" className="mb-5 space-y-2 border-b pb-4"><h2 id="recruiting-application-settings-heading" className="oc-section-heading">Recruiting</h2><div className="flex flex-wrap gap-2">{recruitingSettingsSections.map(item => <Button key={item.id} type="button" variant="outline" size="sm" aria-haspopup="dialog" onClick={() => { if (canLeaveWorkspace()) router.push(`/club/${encodeURIComponent(clubId)}/workspace?${withRecruitingSettings(params.toString(), item.id)}`, { scroll: false }) }}>{item.label}</Button>)}</div></section>}
    {hasPermission(member, "application.manage") && <ApplicationBuilder clubId={clubId} />}
    {/* Voting defaults are recruiting configuration; the Voting room links to #voting-rules. */}
    {hasPermission(member, "applications.review") && hasPermission(member, "decisions.manage") && hasPermission(member, "decisions.start") && !demo.isDemoEnabled && <section id="voting-rules" aria-label="Default voting rules" className="mt-8 border-t pt-5"><VotingRuleDefaults clubId={clubId} /></section>}
  </div>;
}
