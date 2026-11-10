"use client";

import { useEffect, useState } from "react";
import { getProfileFieldVisibility, saveProfileFieldVisibility } from "@/lib/workspace-api";
import { profileFieldKeys, profileFieldLabels, type ProfileFieldKey, type ProfileFieldVisibility } from "@/lib/profile-field-visibility";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";

/** Per-club choice of the applicant profile fields leaders see. Each toggle saves immediately. */
export function ProfileFieldSettings({ clubId }: { clubId: string }) {
  const [fields, setFields] = useState<ProfileFieldVisibility | null>(null);
  const [busy, setBusy] = useState<ProfileFieldKey | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setFields(null); setError("");
    getProfileFieldVisibility(clubId)
      .then(value => { if (current) setFields(value.fields); })
      .catch(() => { if (current) setError("Couldn’t load profile field settings. Your access may have changed."); });
    return () => { current = false; };
  }, [clubId, retry]);
  async function toggle(key: ProfileFieldKey, on: boolean) {
    if (!fields) return;
    setBusy(key); setError(""); setNotice("");
    try {
      const saved = await saveProfileFieldVisibility({ clubId, fields: { ...fields, [key]: on }, expected: fields });
      setFields(saved.fields);
      setNotice(`${profileFieldLabels[key]} ${on ? "shown" : "hidden"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save this field.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section aria-labelledby="profile-fields-heading" className="oc-form-section space-y-4">
      <div className="space-y-1">
        <h2 id="profile-fields-heading" className="oc-section-heading">Applicant profile fields</h2>
        <p className="text-sm text-muted-foreground">Choose what leaders see on applicant profiles, the member roster, exports and voting slides.</p>
      </div>
      {error && <div role="alert" className="oc-feedback flex flex-wrap items-center gap-3">{error}{!fields && <Button variant="outline" size="sm" onClick={() => setRetry(n => n + 1)}>Retry</Button>}</div>}
      {!fields && !error ? <LoadingState label="Loading profile fields…" layout="form" rows={4} /> : fields && (
        <ul className="divide-y rounded-lg border" data-testid="profile-field-toggles">
          {profileFieldKeys.map(key => (
            <li key={key} className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
              <label htmlFor={`profile-field-${key}`} className="text-sm">{profileFieldLabels[key]}</label>
              <Switch id={`profile-field-${key}`} checked={fields[key]} disabled={busy !== null} onCheckedChange={on => void toggle(key, on)} />
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="text-sm text-muted-foreground">{notice}</p>
    </section>
  );
}
