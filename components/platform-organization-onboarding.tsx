"use client";

import { useEffect, useRef, useState } from "react";
import { createOrganizationAndInvitePresident, getOrganizationOnboardingSchools } from "@/actions/platform-organization-onboarding";
import { organizationOnboardingSchema, normalizePresidentIdentifier, type OrganizationOnboardingSchool, type OrganizationOnboardingResult } from "@/lib/platform-organization-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function PlatformOrganizationOnboarding({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  return <>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5">
      <div><h2 className="font-semibold">Onboard an organization</h2><p className="mt-1 text-sm text-muted-foreground">Create its listing and designate the initial president as owner.</p></div>
      <Button type="button" onClick={() => setOpen(true)}>Create organization &amp; invite president</Button>
    </section>
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Create organization &amp; invite president</DialogTitle><DialogDescription>The president receives owner access after accepting with their verified university identity.</DialogDescription></DialogHeader>
        {open && <OrganizationOnboardingForm onBusy={setBusy} onCreated={onCreated} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  </>;
}

export function OrganizationOnboardingForm({ onCreated, onClose, onBusy }: { onCreated: () => void; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const [schools, setSchools] = useState<OrganizationOnboardingSchool[]>([]), [schoolId, setSchoolId] = useState(""),
    [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(""), [loadVersion, setLoadVersion] = useState(0),
    [busy, setBusy] = useState(false), [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({}),
    [result, setResult] = useState<Extract<OrganizationOnboardingResult, { ok: true }> | null>(null),
    [requestId] = useState(() => crypto.randomUUID());
  const submitting = useRef(false);
  useEffect(() => {
    let current = true;
    setLoading(true); setLoadError("");
    getOrganizationOnboardingSchools().then(options => {
      if (!current) return;
      setSchools(options); setSchoolId(options[0]?.identifierTypeId || "");
      if (!options.length) setLoadError("No schools are configured for president invitations.");
    }).catch(() => { if (current) setLoadError("Could not load schools. Verify administrator access and retry."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [loadVersion]);
  const selectedSchool = schools.find(school => school.identifierTypeId === schoolId);
  const errorsFor = (field: string) => fieldErrors[field]?.length ? <p id={`organization-onboarding-${field}-error`} className="mt-1 text-sm text-destructive">{fieldErrors[field]!.join(" ")}</p> : null;
  const errorProps = (field: string) => ({ "aria-invalid": !!fieldErrors[field]?.length, "aria-describedby": fieldErrors[field]?.length ? `organization-onboarding-${field}-error` : undefined });

  if (result) return <section role="status" className="space-y-4" aria-live="polite">
    <h3 className="text-lg font-semibold">{result.organization.name} created</h3>
    <p className="text-sm">{result.invitation.state === "PENDING" ? `An owner invitation is pending for ${result.invitation.identifier}.` : `Owner invitation status: ${result.invitation.state.toLowerCase()}.`}</p>
    <p className="text-sm text-muted-foreground">{result.accountMatch === "EXISTING" ? "An existing OutClass account matches this university address. The president can claim the organization after verified sign-in." : "The president can create an OutClass account with their university identity, then accept the invitation."}</p>
    <p className="text-sm">Email has not been sent. Share the invitation link with the president.</p>
    <a href={result.invitation.url} className="block break-all text-sm underline">Open president invitation</a>
    <Input readOnly aria-label="President invitation link" value={typeof window === "undefined" ? result.invitation.url : new URL(result.invitation.url, window.location.origin).href} onFocus={event => event.currentTarget.select()} />
    <p className="text-xs text-muted-foreground">Invitation address: {result.invitation.email}{result.reused ? " · Previous submission recovered" : ""}</p>
    <Button type="button" onClick={onClose}>Done</Button>
  </section>;

  return <form className="space-y-4" aria-busy={busy || loading} noValidate onSubmit={async event => {
    event.preventDefault();
    if (submitting.current || loading || !selectedSchool) return;
    const form = new FormData(event.currentTarget);
    const parsed = organizationOnboardingSchema.safeParse({
      requestId, identifierTypeId: schoolId, organizationName: String(form.get("organizationName") || ""),
      presidentName: String(form.get("presidentName") || ""), presidentIdentifier: String(form.get("presidentIdentifier") || ""),
      presidentYear: String(form.get("presidentYear") || ""), reason: String(form.get("reason") || ""),
    });
    setError(""); setFieldErrors({});
    if (!parsed.success) { setFieldErrors(parsed.error.flatten().fieldErrors); setError("Check the highlighted fields."); return; }
    try { parsed.data.presidentIdentifier = normalizePresidentIdentifier(parsed.data.presidentIdentifier, selectedSchool); }
    catch { setFieldErrors({ presidentIdentifier: [`Enter a valid ${selectedSchool.identifierLabel}.`] }); setError("Check the highlighted fields."); return; }
    submitting.current = true; setBusy(true); onBusy(true);
    try {
      const response = await createOrganizationAndInvitePresident(parsed.data);
      if (response.ok) { setResult(response); onCreated(); }
      else { setError(response.error); setFieldErrors(response.fieldErrors || {}); }
    } catch { setError("Could not confirm creation. Retry this submission to recover its result without creating duplicates."); }
    finally { submitting.current = false; setBusy(false); onBusy(false); }
  }}>
    {loading && <p role="status" className="text-sm">Loading available schools…</p>}
    {loadError && <p role="alert" className="text-sm text-destructive">{loadError} <Button type="button" variant="outline" disabled={loading} onClick={() => setLoadVersion(version => version + 1)}>Retry schools</Button></p>}
    <fieldset disabled={busy || loading || !!loadError} className="space-y-4">
      <label className="block text-sm">School
        <select value={schoolId} onChange={event => setSchoolId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-input bg-card px-3" required {...errorProps("identifierTypeId")}>
          {!schools.length && <option value="">Choose a school</option>}
          {schools.map(school => <option key={school.identifierTypeId} value={school.identifierTypeId}>{school.schoolName}{schools.filter(other => other.schoolName === school.schoolName).length > 1 ? ` · ${school.identifierLabel}` : ""}</option>)}
        </select>{errorsFor("identifierTypeId")}
      </label>
      <label className="block text-sm">Organization name<Input name="organizationName" placeholder="Madison Investment Fund" minLength={2} maxLength={150} required {...errorProps("organizationName")} />{errorsFor("organizationName")}</label>
      <label className="block text-sm">President name<Input name="presidentName" placeholder="John Smith" autoComplete="name" minLength={2} maxLength={150} required {...errorProps("presidentName")} />{errorsFor("presidentName")}</label>
      <label className="block text-sm">President computing ID<Input name="presidentIdentifier" placeholder="jms8xy" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={128} required {...errorProps("presidentIdentifier")} />{errorsFor("presidentIdentifier")}</label>
      <label className="block text-sm">President year<Input name="presidentYear" placeholder="2027" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} required {...errorProps("presidentYear")} />{errorsFor("presidentYear")}</label>
      <label className="block text-sm">Onboarding reason<Textarea name="reason" defaultValue="Initial organization onboarding and president invitation." minLength={10} maxLength={1000} required {...errorProps("reason")} />{errorsFor("reason")}</label>
      <p className="text-sm text-muted-foreground">Submitting creates the organization and an invitation for its initial owner. Ownership starts when the president accepts.</p>
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <Button disabled={busy || loading || !!loadError || !selectedSchool}>{busy ? "Creating organization…" : "Create organization & invite president"}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
    </div>
  </form>;
}
