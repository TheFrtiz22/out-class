"use client";
import { useEffect, useState } from "react";
import { getAdminSettings, saveAdminSettings } from "@/actions/admin-workspace";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
export function AdminSettings() {
  const [value, setValue] = useState({ supportEmail: "", campusNotice: "", maintenanceNotice: "", maintenanceMode: false }), [saved, setSaved] = useState(false), [reason, setReason] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(true);
  useEffect(() => { let live = true; getAdminSettings().then(v => { if (live) { setValue(v); setSaved(v.maintenanceMode); } }).catch(e => { if (live) setMessage(e.message); }).finally(() => { if (live) setBusy(false); }); return () => { live = false; }; }, []);
  const confirmation = value.maintenanceMode !== saved
    ? value.maintenanceMode ? "Turn maintenance mode ON? Everyone except platform administrators will see the maintenance page and cannot make changes." : "Turn maintenance mode OFF and reopen OutClass to everyone?"
    : "Save these platform settings? Notices appear site-wide within a minute.";
  return <form className="max-w-[var(--oc-reading-width)] space-y-5" onSubmit={async e => { e.preventDefault(); if (!window.confirm(confirmation)) return; setBusy(true); try { await saveAdminSettings(value, reason); setSaved(value.maintenanceMode); setMessage("Settings saved."); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); } }}>
    <p className="text-sm text-muted-foreground">Notices are shown site-wide, at the top of public and signed-in pages, as plain text. They are not emailed or sent to inboxes. Leave a notice empty to hide it.</p>
    <label className="oc-field">Support email<Input type="email" value={value.supportEmail} onChange={e => setValue(v => ({ ...v, supportEmail: e.target.value }))} /></label>
    {(["campusNotice", "maintenanceNotice"] as const).map(key => <label key={key} className="oc-field">{key === "campusNotice" ? "Campus notice (people can dismiss it for their session)" : "Maintenance notice (always shown)"}<Textarea maxLength={500} value={value[key]} onChange={e => setValue(v => ({ ...v, [key]: e.target.value }))} /></label>)}
    <Toggle label="Maintenance mode" description="Off by default. When on, only platform administrators can use the product and make changes; public pages stay up with the maintenance notice." checked={value.maintenanceMode} onCheckedChange={checked => setValue(v => ({ ...v, maintenanceMode: checked }))} />
    <label className="oc-field">Reason<Textarea minLength={10} required value={reason} onChange={e => setReason(e.target.value)} /></label>
    <Button disabled={busy || reason.trim().length < 10}>Save settings</Button><p role="status">{message}</p>
  </form>;
}
