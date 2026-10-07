"use client";
import { useEffect, useState } from "react";
import { getAdminSettings, saveAdminSettings } from "@/actions/admin-workspace";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
export function AdminSettings() {
  const [value, setValue] = useState({ supportEmail: "", campusNotice: "", maintenanceNotice: "" }), [reason, setReason] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(true);
  useEffect(() => { let live = true; getAdminSettings().then(v => { if (live) setValue(v); }).catch(e => { if (live) setMessage(e.message); }).finally(() => { if (live) setBusy(false); }); return () => { live = false; }; }, []);
  return <form className="max-w-2xl space-y-5" onSubmit={async e => { e.preventDefault(); if (!window.confirm("Save these platform settings?")) return; setBusy(true); try { await saveAdminSettings(value, reason); setMessage("Settings saved."); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); } }}><p className="text-sm text-muted-foreground">These settings are stored for platform administration. Notices are not currently displayed outside Admin or broadcast, emailed, or sent to users.</p><label className="block">Support email<Input type="email" value={value.supportEmail} onChange={e => setValue(v => ({ ...v, supportEmail: e.target.value }))} /></label>{["campusNotice", "maintenanceNotice"].map(key => <label key={key} className="block">{key === "campusNotice" ? "Campus notice" : "Maintenance notice"}<Textarea maxLength={500} value={value[key as keyof typeof value]} onChange={e => setValue(v => ({ ...v, [key]: e.target.value }))} /></label>)}<label className="block">Reason<Textarea minLength={10} required value={reason} onChange={e => setReason(e.target.value)} /></label><Button disabled={busy || reason.trim().length < 10}>Save settings</Button><p role="status">{message}</p></form>;
}
