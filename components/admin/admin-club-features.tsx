"use client";
import { useRef, useState } from "react";
import { setAdminClubFeature } from "@/actions/admin-clubs";
import { clubFeatureKeys, clubFeatureLabels, type ClubFeatureKey, type ClubFeatures } from "@/lib/club-features";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal } from "@/components/icons";

/** Platform-admin pilot switches for one club. The server re-checks admin access and the current state on every change. */
export function AdminClubFeatures({ clubId, initial, onSupportCode }: { clubId: string; initial: ClubFeatures; onSupportCode: (code: string) => void }) {
  const [features, setFeatures] = useState(initial), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const inFlight = useRef(false);
  async function toggle(key: ClubFeatureKey, enabled: boolean) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const r = await setAdminClubFeature({ clubId, key, enabled, expected: features[key], reason });
      if (r.supportCode) { onSupportCode(r.supportCode); return; }
      if (r.features) setFeatures(r.features);
      if (r.error) setError(r.error);
      else setMessage(`${clubFeatureLabels[key]} ${enabled ? "on" : "off"}.`);
    } catch { setError("Feature could not be changed. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const ready = reason.trim().length >= 10;
  return <fieldset disabled={busy} className="oc-content-panel min-w-0 space-y-4">
    <legend className="flex items-center gap-2 px-2 font-semibold"><SlidersHorizontal aria-hidden="true" className="size-4" />Pilot features</legend>
    <label className="block space-y-2 text-sm">Reason for change<Input minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
    <ul className="divide-y">{clubFeatureKeys.map(key => <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
      <span id={`feature-${key}`}>{clubFeatureLabels[key]}</span>
      <Switch aria-labelledby={`feature-${key}`} checked={features[key]} disabled={!ready} onCheckedChange={checked => void toggle(key, checked)} />
    </li>)}</ul>
    <p className="text-xs text-muted-foreground">{ready ? "Off unless switched on for this club." : "Enter a reason to change a switch."}</p>
    {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </fieldset>;
}
