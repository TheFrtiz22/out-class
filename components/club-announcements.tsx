"use client";
import { useEditorDraft } from "@/hooks/use-editor-draft"
import { AutosaveStatus } from "@/components/ui/autosave-status"

import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoMode } from "@/contexts/demo-context";
import { communicationsChanged } from "@/lib/communications-client";
import { Plus, Send } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { getClubAnnouncements, publishClubAnnouncement } from "@/actions/communications";
import { RecipientGroups, AudienceEditor, AudiencePreview } from "@/components/recipient-audiences";
import { getRecipientGroups, previewRecipientAudience } from "@/actions/recipient-groups";
import { recipientAudienceSchema } from "@/lib/recipient-audience";
import { saveCommunicationSchedule } from "@/actions/communication-schedules";
import { ScheduledCommunications, ScheduleFields, initialTiming, type ScheduledItem } from "@/components/communication-schedules";
type Item = Awaited<ReturnType<typeof getClubAnnouncements>>[number];

export function ClubAnnouncements({ clubId }: { clubId: string }) {
 const demo = useDemoMode();
 const [sendMode,setSendMode]=useState<"NOW"|"SCHEDULE">("NOW");
 const [timing,setTiming]=useState(initialTiming);
 const [editing,setEditing]=useState<ScheduledItem|null>(null);
 const [scheduleRefresh,setScheduleRefresh]=useState(0);
 const requestKey = useRef<string | null>(null);
 const [items, setItems] = useState<Item[]>([]);
 const [busy, setBusy] = useState(false);
 const [compose, setCompose] = useState(false);
 const [confirmPublish, setConfirmPublish] = useState(false);
 const publishing = useRef(false);
 const [title, setTitle] = useState("");
 const [body, setBody] = useState("");
 const [audience, setAudience] = useState<"MEMBERS" | "APPLICANTS" | "CUSTOM">("MEMBERS");
 const [catalog,setCatalog]=useState<Awaited<ReturnType<typeof getRecipientGroups>>|null>(null);
 const [audienceSpec,setAudienceSpec]=useState(()=>recipientAudienceSchema.parse({include:[{source:"MEMBERS"}]}));
 const [preview,setPreview]=useState<Awaited<ReturnType<typeof previewRecipientAudience>>|null>(null);
 const [error, setError] = useState("");
 const [success, setSuccess] = useState("");
 const reload = useCallback(async () => {
  if (demo.isDemoEnabled) return;
  try { setItems(await getClubAnnouncements(clubId)); }
  catch (e) { setError(e instanceof Error ? e.message : "Could not load announcements."); }
 }, [clubId, demo.isDemoEnabled]);
 useEffect(() => { void reload(); }, [reload]);
 const draftSave = useEditorDraft({
  scope: { kind: "announcement", clubId, resourceId: editing?.id ?? "new" },
  value: { title, body, audience, audienceSpec, sendMode, timing },
  restore: draft => { setTitle(draft.title); setBody(draft.body); setAudience(draft.audience); setAudienceSpec(draft.audienceSpec); setSendMode(draft.sendMode); setTiming(draft.timing) },
  enabled: compose, base: editing ? String(editing.revision) : "new",
 });
 async function publish() {
  if (publishing.current) return;
  publishing.current = true;
  setBusy(true); setError(""); setSuccess("");
  try {
   await draftSave.flush();
   requestKey.current ||= crypto.randomUUID();
   if(sendMode==="SCHEDULE") {
    await saveCommunicationSchedule({id:editing?.id??requestKey.current,clubId,revision:editing?.revision??null,title,body,audience:audience==="CUSTOM"?audienceSpec:{include:[{source:audience}]},...timing});
    setSuccess("Scheduled. Recipients and permissions will be checked at publication; optional email follows delivery preferences.");
    setScheduleRefresh(v=>v+1);
   } else {
   const result = await publishClubAnnouncement({ clubId, title, body, audience, ...(audience==="CUSTOM"?{audienceSpec}:{}), requestKey: requestKey.current });
   communicationsChanged();
   setSuccess("Published to " + result.recipientCount + " recipient(s). Optional emails follow each recipient’s preferences.");
   }
   await draftSave.clear();
   requestKey.current=null;setEditing(null);
   setTitle(""); setBody(""); setConfirmPublish(false); setCompose(false); await reload();
  } catch (e) { setError(e instanceof Error ? e.message : "Publishing failed."); }
  finally { publishing.current = false; setBusy(false); }
 }
 if (demo.isDemoEnabled) return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Announcement publishing is available when signed into your live OutClass account.</p>;
 return <div className="max-w-5xl space-y-7" data-saving={busy} data-unsaved={draftSave.dirty}>
  <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="oc-section-heading">Announcements</h2><p className="mt-2 text-sm text-muted-foreground">Publish to your club’s current members or submitted applicants.</p></div><Button onClick={()=>{setCompose(true);setEditing(null);setSendMode("NOW");setError("");setSuccess("");void getRecipientGroups(clubId).then(setCatalog).catch(e=>setError(e instanceof Error?e.message:"Audiences unavailable."));}}><Plus className="size-4" /> New announcement</Button></div>
  <RecipientGroups clubId={clubId} />
  <ScheduledCommunications clubId={clubId} refresh={scheduleRefresh} onEdit={row=>{setEditing(row);setTitle(row.title);setBody(row.body);setAudience("CUSTOM");setAudienceSpec(recipientAudienceSchema.parse(row.audience));setTiming({localTime:row.localTime,timeZone:row.timeZone,occurrence:row.occurrence as "EARLIER"|"LATER",recipientMode:row.recipientMode as "FIXED"|"SEND_TIME"});setSendMode("SCHEDULE");setPreview(null);setError("");setCompose(true);void getRecipientGroups(clubId).then(setCatalog).catch(()=>setError("Audience catalog unavailable."));}}/>
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  {success && <p role="status" className="text-sm">{success}</p>}
  {items.length ? <ul className="divide-y border-y">{items.map(item=><li key={item.id} className="space-y-2 py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-xs text-muted-foreground">{item.audience === "MEMBERS" ? "Members" : item.audience==="CUSTOM"?"Custom audience":"Active applicants"} · {item._count.notifications} notified</span></div><p className="whitespace-pre-wrap break-words text-sm leading-7">{item.body}</p><time className="block text-xs text-muted-foreground">{new Date(item.publishedAt).toLocaleString()}</time></li>)}</ul> : <p className="rounded-lg border p-8 text-sm text-muted-foreground">No announcements published yet.</p>}
  <Sheet open={compose} onOpenChange={open=>{if(busy) return;if(!open){void draftSave.flush().then(()=>setCompose(false)).catch(()=>{});return;}setCompose(open);}}>
   <SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-xl"><SheetTitle>{editing?"Edit scheduled announcement":"New announcement"}</SheetTitle><SheetDescription>Choose the audience and publish a permanent in-app update.</SheetDescription>
   <AutosaveStatus save={draftSave} />
   <form data-autosave-editor="true" onBlur={draftSave.onBlur} className="mt-7 space-y-6" data-unsaved={draftSave.dirty} onSubmit={e=>{e.preventDefault();if(!busy)setConfirmPublish(true);}}>
    <label className="block space-y-2 text-sm font-medium">Publication<select disabled={busy||!!editing} className="w-full rounded border bg-background p-3" value={sendMode} onChange={e=>{setSendMode(e.target.value as "NOW"|"SCHEDULE");requestKey.current=null;}}><option value="NOW">Send now</option><option value="SCHEDULE">Schedule</option></select></label>
    {sendMode==="SCHEDULE"&&<ScheduleFields value={timing} disabled={busy || !draftSave.ready || draftSave.recovery != null} onChange={v=>{setTiming(v);requestKey.current=null;}}/>}
    <label className="block space-y-2 text-sm font-medium">Title<Input required disabled={busy || !draftSave.ready || draftSave.recovery != null} maxLength={200} value={title} onChange={e=>{setTitle(e.target.value);requestKey.current=null;}} /></label>
    <label className="block space-y-2 text-sm font-medium">Recipients<select disabled={busy || !draftSave.ready || draftSave.recovery != null} className="w-full rounded-md border bg-background p-3" value={audience} onChange={e=>{setAudience(e.target.value as typeof audience);setPreview(null);requestKey.current=null;}}><option value="MEMBERS">Current club members</option><option value="APPLICANTS">Active submitted applicants (excludes rejected)</option><option value="CUSTOM">Groups and audience filters</option></select></label>
    {audience==="CUSTOM"&&<AudienceEditor disabled={busy || !draftSave.ready || draftSave.recovery != null} catalog={catalog} value={audienceSpec} onChange={v=>{setAudienceSpec(v);setPreview(null);requestKey.current=null;}} />}
    <Button type="button" variant="outline" disabled={busy || !draftSave.ready || draftSave.recovery != null} onClick={async()=>{setBusy(true);setError("");try{setPreview(await previewRecipientAudience(clubId,audience==="CUSTOM"?audienceSpec:{include:[{source:audience}]}));}catch(e){setError(e instanceof Error?e.message:"Preview failed.");}finally{setBusy(false);}}}>Preview recipients and count</Button>
    <AudiencePreview preview={preview} />
    <label className="block space-y-2 text-sm font-medium">Announcement<Textarea required disabled={busy || !draftSave.ready || draftSave.recovery != null} maxLength={10000} className="min-h-56" value={body} onChange={e=>{setBody(e.target.value);requestKey.current=null;}} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy || !title.trim() || !body.trim()}><Send className="size-4" /> {busy?"Publishing…":sendMode==="SCHEDULE"?"Save scheduled send":"Send now"}</Button>
   </form></SheetContent>
  </Sheet>
  <AlertDialog open={confirmPublish} onOpenChange={open=>{if(!busy)setConfirmPublish(open);}}>
   <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{sendMode==="SCHEDULE"?"Save this scheduled send?":"Publish this announcement?"}</AlertDialogTitle><AlertDialogDescription>{sendMode==="SCHEDULE"?"No inbox content is published yet. Sender authority and recipient eligibility will be rechecked when due.":"The currently resolved audience will receive an in-app update and optional email according to their preferences."}</AlertDialogDescription></AlertDialogHeader>
    {sendMode==="SCHEDULE"&&<p className="break-words text-sm">{timing.localTime.replace("T"," ")} · {timing.timeZone} · {timing.occurrence.toLowerCase()} occurrence · {timing.recipientMode==="FIXED"?"Freeze current selection":"Evaluate audience at publication"}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <AlertDialogFooter><AlertDialogCancel disabled={busy || !draftSave.ready || draftSave.recovery != null}>Keep editing</AlertDialogCancel><Button disabled={busy || !draftSave.ready || draftSave.recovery != null} onClick={()=>void publish()}>{busy?"Publishing…":sendMode==="SCHEDULE"?"Confirm schedule":"Confirm publication"}</Button></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </div>;
}
