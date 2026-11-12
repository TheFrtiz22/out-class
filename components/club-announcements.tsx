"use client";
import { unwrapped } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"
import { useEditorDraft } from "@/hooks/use-editor-draft"
import { ActionWorkflow } from "@/components/product/action-workflow";
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
import { publishClubAnnouncement as publishClubAnnouncementAction } from "@/actions/communications";
const publishClubAnnouncement = unwrapped(publishClubAnnouncementAction);
import { getClubAnnouncements } from "@/lib/workspace-read";
import { RecipientGroups, AudienceEditor, AudiencePreview } from "@/components/recipient-audiences";
import { getRecipientGroups, previewRecipientAudience as previewRecipientAudienceAction } from "@/actions/recipient-groups";
const previewRecipientAudience = unwrapped(previewRecipientAudienceAction);
import { recipientAudienceSchema } from "@/lib/recipient-audience";
import { saveCommunicationSchedule as saveCommunicationScheduleAction } from "@/actions/communication-schedules";
const saveCommunicationSchedule = unwrapped(saveCommunicationScheduleAction);
import { ScheduledCommunications, ScheduleFields, initialTiming, type ScheduledItem } from "@/components/communication-schedules";
import { NativeSelect } from "@/components/ui/native-select"
import { useSearchParams } from "next/navigation"
import { formatDateTime, formatShortDate } from "@/lib/copy/terms"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import { DataTable, DataTableSecondary } from "@/components/ui/data-table"
import { joinFacts } from "@/lib/join-facts"
import { SortControl } from "@/components/ui/sort-control"
import { useListSort } from "@/hooks/use-list-sort"
type Item = Awaited<ReturnType<typeof getClubAnnouncements>>[number];
const sortKeys = ["published", "title", "notified"] as const;
type AnnouncementSort = (typeof sortKeys)[number];
const sortOptions: { key: AnnouncementSort; label: string }[] = [{ key: "published", label: "Published" }, { key: "title", label: "Title" }, { key: "notified", label: "Notified" }];
const sortsDescending = (key: AnnouncementSort) => key !== "title";
const audienceLabel = (item: Item) => item.audience === "MEMBERS" ? "Members" : item.audience === "CUSTOM" ? "Custom audience" : "Active applicants";

export function ClubAnnouncements({ clubId, initialItems }: { clubId: string; initialItems?: Item[] }) {
 const demo = useDemoMode();
 const [sendMode,setSendMode]=useState<"NOW"|"SCHEDULE">("NOW");
 const [timing,setTiming]=useState(initialTiming);
 const [editing,setEditing]=useState<ScheduledItem|null>(null);
 const [scheduleRefresh,setScheduleRefresh]=useState(0);
 const requestKey = useRef<string | null>(null);
 const [items, setItems] = useState<Item[]>(initialItems ?? []);
 const listSort = useListSort(sortKeys, "published", sortsDescending);
 const [reading, setReading] = useState<Item | null>(null);
 const readingOrigin = useRef<HTMLElement | null>(null);
 const sorted = [...items].sort((a, b) => { const compared = listSort.key === "title" ? a.title.localeCompare(b.title) : listSort.key === "notified" ? a._count.notifications - b._count.notifications : new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(); return (listSort.descending ? -compared : compared) || a.id.localeCompare(b.id); });
 const firstRead = useRef(initialItems !== undefined);
 const [busy, setBusy] = useState(false);
 const [compose, setCompose] = useState(false);
 const openComposer=()=>{setCompose(true);setEditing(null);setSendMode("NOW");setPreview(null);setError("");setSuccess("");void getRecipientGroups(clubId).then(setCatalog).catch(e=>setError(userMessage(e, "Audiences unavailable.")));};
 // Club home "New announcement" links here with `compose=1` to open the composer directly.
 const composeRequested=useSearchParams()?.get("compose")==="1";
 const composeOpened=useRef(false);
 useEffect(()=>{if(composeRequested&&!composeOpened.current){composeOpened.current=true;openComposer();}},[composeRequested]);// eslint-disable-line react-hooks/exhaustive-deps
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
  catch (e) { setError(userMessage(e, "Could not load announcements.")); }
 }, [clubId, demo.isDemoEnabled]);
 useEffect(() => { if (firstRead.current) { firstRead.current = false; return; } void reload(); }, [reload]);
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
    setSuccess("Scheduled. Recipients and permissions are checked when it sends. Email follows each person’s settings.");
    setScheduleRefresh(v=>v+1);
   } else {
   const result = await publishClubAnnouncement({ clubId, title, body, audience, ...(audience==="CUSTOM"?{audienceSpec}:{}), requestKey: requestKey.current });
   communicationsChanged();
   setSuccess("Published to " + result.recipientCount + " recipient(s). Optional emails follow each recipient’s preferences.");
   }
   await draftSave.clear();
   requestKey.current=null;setEditing(null);
   setTitle(""); setBody(""); setConfirmPublish(false); setCompose(false); await reload();
  } catch (e) { setError(userMessage(e, "Publishing failed.")); }
  finally { publishing.current = false; setBusy(false); }
 }
 if (demo.isDemoEnabled) return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Announcement publishing is available when signed into your live OutClass account.</p>;
 return <div className="oc-workspace-stack" data-saving={busy} data-unsaved={draftSave.dirty}>
  <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="mt-2 text-sm text-muted-foreground">Publish to your club’s current members or submitted applicants.</p></div><Button onClick={openComposer}><Plus className="size-4" /> Create announcement</Button></div>
  <div className="flex flex-wrap gap-2">
    <ActionWorkflow title="Scheduled announcements" description="Review, edit or cancel announcements scheduled for later." trigger="Scheduled announcements" presentation="sheet">  <ScheduledCommunications clubId={clubId} refresh={scheduleRefresh} onEdit={row=>{setEditing(row);setTitle(row.title);setBody(row.body);setAudience("CUSTOM");setAudienceSpec(recipientAudienceSchema.parse(row.audience));setTiming({localTime:row.localTime,timeZone:row.timeZone,occurrence:row.occurrence as "EARLIER"|"LATER",recipientMode:row.recipientMode as "FIXED"|"SEND_TIME"});setSendMode("SCHEDULE");setPreview(null);setError("");setCompose(true);void getRecipientGroups(clubId).then(setCatalog).catch(()=>setError("Audience catalog unavailable."));}}/></ActionWorkflow>
    <ActionWorkflow title="Audience groups" description="Manage reusable recipient groups for announcements." trigger="Manage audiences" presentation="sheet"><RecipientGroups clubId={clubId} /></ActionWorkflow>
  </div>
  {error && <p role="alert" className="oc-feedback">{error}</p>}
  {success && <p role="status" className="text-sm">{success}</p>}
  {items.length > 0 && <div className="oc-list-toolbar justify-end"><SortControl label="Sort announcements" options={sortOptions} value={listSort.key} descending={listSort.descending} descendingByDefault={sortsDescending} onChange={listSort.set} /></div>}
  {items.length ? <DataTable caption="Published announcements" rows={sorted} rowKey={item => item.id}
   sort={{ key: listSort.key, descending: listSort.descending, toggle: key => listSort.toggle(key as AnnouncementSort) }}
   openLabel={item => `Read ${item.title}`}
   onOpen={(item, origin) => { readingOrigin.current = origin; setReading(item); }}
   columns={[
    { id: "title", header: "Announcement", sortKey: "title", primary: true, className: "oc-dt-fill", cell: item => <span className="oc-dt-name">{item.title}</span>, secondary: item => <DataTableSecondary from="md">{item.body}</DataTableSecondary> },
    { id: "audience", header: "Audience", showFrom: "md", cell: audienceLabel },
    { id: "notified", header: "Notified", sortKey: "notified", align: "end", cell: item => item._count.notifications },
    { id: "published", header: "Published", sortKey: "published", cell: item => <time dateTime={new Date(item.publishedAt).toISOString()} title={formatDateTime(item.publishedAt, { timeZone: SCHEDULING_TIMEZONE })}>{formatShortDate(item.publishedAt, { timeZone: SCHEDULING_TIMEZONE })}</time> },
   ]}
   card={{ title: item => item.title, preview: item => item.body, meta: item => joinFacts(formatShortDate(item.publishedAt, { timeZone: SCHEDULING_TIMEZONE }), audienceLabel(item), `${item._count.notifications} notified`) }} /> : <p className="oc-content-panel text-sm text-muted-foreground">No announcements published yet.</p>}
  <Sheet open={!!reading} onOpenChange={open => { if (!open) setReading(null); }}>
   <SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-xl" onCloseAutoFocus={e => { if (readingOrigin.current?.isConnected) { e.preventDefault(); readingOrigin.current.focus(); } }}>
    <SheetTitle>{reading?.title}</SheetTitle>
    <SheetDescription>{reading && joinFacts(formatDateTime(reading.publishedAt, { timeZone: SCHEDULING_TIMEZONE }), audienceLabel(reading), `${reading._count.notifications} notified`)}</SheetDescription>
    {reading && <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-7">{reading.body}</p>}
   </SheetContent>
  </Sheet>
  <Sheet open={compose} onOpenChange={open=>{if(busy) return;if(!open){void draftSave.flush().then(()=>setCompose(false)).catch(()=>{});return;}setCompose(open);}}>
   <SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-xl"><SheetTitle>{editing?"Edit scheduled announcement":"New announcement"}</SheetTitle><SheetDescription>Choose the audience and publish a permanent in-app update.</SheetDescription>
   <AutosaveStatus save={draftSave} />
   <form data-autosave-editor="true" onBlur={draftSave.onBlur} className="mt-7 space-y-6" data-unsaved={draftSave.dirty} onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");try{setPreview(await previewRecipientAudience(clubId,audience==="CUSTOM"?audienceSpec:{include:[{source:audience}]}));setConfirmPublish(true)}catch(e){setError(userMessage(e, "Could not preview recipients."))}finally{setBusy(false)}}}>
    <label className="block space-y-2 text-sm font-medium">Title<Input required disabled={busy || !draftSave.ready || draftSave.recovery != null} maxLength={200} value={title} onChange={e=>{setTitle(e.target.value);requestKey.current=null;}} /></label>
    <label className="block space-y-2 text-sm font-medium">Announcement<Textarea required disabled={busy || !draftSave.ready || draftSave.recovery != null} maxLength={10000} className="min-h-56" value={body} onChange={e=>{setBody(e.target.value);requestKey.current=null;}} /></label>
    <label className="block space-y-2 text-sm font-medium">Publication<NativeSelect disabled={busy||!!editing} className="w-full" value={sendMode} onChange={e=>{setSendMode(e.target.value as "NOW"|"SCHEDULE");requestKey.current=null;}}><option value="NOW">Publish now</option><option value="SCHEDULE">Schedule</option></NativeSelect></label>
    {sendMode==="SCHEDULE"&&<ScheduleFields value={timing} disabled={busy || !draftSave.ready || draftSave.recovery != null} onChange={v=>{setTiming(v);requestKey.current=null;}}/>}
    <div role="group" aria-label="Recipient type" className="flex flex-wrap gap-2"><Button type="button" variant={audience !== "APPLICANTS" ? "secondary" : "outline"} disabled={busy || !draftSave.ready || draftSave.recovery != null} onClick={() => { setAudience("MEMBERS"); setAudienceSpec(recipientAudienceSchema.parse({ include: [{ source: "MEMBERS" }] })); setPreview(null); requestKey.current = null; }}>Members & groups</Button><Button type="button" variant={audience === "APPLICANTS" ? "secondary" : "outline"} disabled={busy || !draftSave.ready || draftSave.recovery != null} onClick={() => { setAudience("APPLICANTS"); setPreview(null); requestKey.current = null; }}>Active applicants</Button></div>
    {audience !== "APPLICANTS" && <AudienceEditor disabled={busy || !draftSave.ready || draftSave.recovery != null} catalog={catalog} value={audienceSpec} onChange={value => { setAudience("CUSTOM"); setAudienceSpec(value); setPreview(null); requestKey.current = null; }} />}
    <Button type="button" variant="outline" disabled={busy || !draftSave.ready || draftSave.recovery != null} onClick={async()=>{setBusy(true);setError("");try{setPreview(await previewRecipientAudience(clubId,audience==="CUSTOM"?audienceSpec:{include:[{source:audience}]}));}catch(e){setError(userMessage(e, "Preview failed."));}finally{setBusy(false);}}}>Preview recipients and count</Button>
    <AudiencePreview preview={preview} />

    {error && <p role="alert" className="oc-feedback">{error}</p>}
    <div className="oc-form-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => { void draftSave.flush().then(() => setCompose(false)).catch(() => {}) }}>Cancel</Button><Button type="submit" disabled={busy || !draftSave.ready || draftSave.recovery != null || !title.trim() || !body.trim()}><Send className="size-4" /> {busy?"Reviewing recipients…":sendMode==="SCHEDULE"?"Review schedule":"Publish announcement"}</Button></div>
   </form></SheetContent>
  </Sheet>
  <AlertDialog open={confirmPublish} onOpenChange={open=>{if(!busy)setConfirmPublish(open);}}>
   <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{sendMode==="SCHEDULE"?"Save this scheduled send?":"Publish this announcement?"}</AlertDialogTitle><AlertDialogDescription>{sendMode==="SCHEDULE"?"Nothing sent to the inbox yet. Permissions and recipients are checked again when it sends.":"The currently resolved audience will receive an in-app update and optional email according to their preferences."}</AlertDialogDescription></AlertDialogHeader>
    <section className="max-h-60 space-y-3 overflow-y-auto rounded-lg bg-muted/40 p-4"><h3 className="font-medium">{title}</h3><p className="whitespace-pre-wrap break-words text-sm">{body}</p><AudiencePreview preview={preview} /></section>
    {sendMode==="SCHEDULE"&&<p className="break-words text-sm">{timing.localTime.replace("T"," ")} · {timing.timeZone} · {timing.occurrence.toLowerCase()} occurrence · {timing.recipientMode==="FIXED"?"Freeze current selection":"Choose the audience when it sends"}</p>}
    {error && <p role="alert" className="oc-feedback">{error}</p>}
    <AlertDialogFooter><AlertDialogCancel disabled={busy || !draftSave.ready || draftSave.recovery != null}>Keep editing</AlertDialogCancel><Button disabled={busy || !draftSave.ready || draftSave.recovery != null} onClick={()=>void publish()}>{busy?"Publishing…":sendMode==="SCHEDULE"?"Confirm schedule":"Publish announcement"}</Button></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </div>;
}
