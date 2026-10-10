"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoMode } from "@/contexts/demo-context";
import { communicationsChanged } from "@/lib/communications-client";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { getClubAnnouncements, publishClubAnnouncement } from "@/actions/communications";
type Item = Awaited<ReturnType<typeof getClubAnnouncements>>[number];

export function ClubAnnouncements({ clubId }: { clubId: string }) {
 const demo = useDemoMode();
 const requestKey = useRef<string | null>(null);
 const [items, setItems] = useState<Item[]>([]);
 const [busy, setBusy] = useState(false);
 const [compose, setCompose] = useState(false);
 const [confirmPublish, setConfirmPublish] = useState(false);
 const publishing = useRef(false);
 const [title, setTitle] = useState("");
 const [body, setBody] = useState("");
 const [audience, setAudience] = useState<"MEMBERS" | "APPLICANTS">("MEMBERS");
 const [error, setError] = useState("");
 const [success, setSuccess] = useState("");
 const dirty = compose && (!!title.trim() || !!body.trim());
 const reload = useCallback(async () => {
  if (demo.isDemoEnabled) return;
  try { setItems(await getClubAnnouncements(clubId)); }
  catch (e) { setError(e instanceof Error ? e.message : "Could not load announcements."); }
 }, [clubId, demo.isDemoEnabled]);
 useEffect(() => { void reload(); }, [reload]);
 useEffect(() => {
  if (!dirty) return;
  const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
  window.addEventListener("beforeunload",warn);
  return () => window.removeEventListener("beforeunload",warn);
 }, [dirty]);
 async function publish() {
  if (publishing.current) return;
  publishing.current = true;
  setBusy(true); setError(""); setSuccess("");
  try {
   requestKey.current ||= crypto.randomUUID();
   const result = await publishClubAnnouncement({ clubId, title, body, audience, requestKey: requestKey.current });
   requestKey.current = null; communicationsChanged();
   setSuccess("Published to " + result.recipientCount + " recipient(s). Optional emails follow each recipient’s preferences.");
   setTitle(""); setBody(""); setConfirmPublish(false); setCompose(false); await reload();
  } catch (e) { setError(e instanceof Error ? e.message : "Publishing failed."); }
  finally { publishing.current = false; setBusy(false); }
 }
 if (demo.isDemoEnabled) return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Announcement publishing is available when signed into your live OutClass account.</p>;
 return <div className="max-w-5xl space-y-7" data-saving={busy} data-unsaved={dirty}>
  <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="oc-section-heading">Announcements</h2><p className="mt-2 text-sm text-muted-foreground">Publish to your club’s current members or submitted applicants.</p></div><Button onClick={()=>{setCompose(true);setError("");setSuccess("");}}><Plus className="size-4" /> New announcement</Button></div>
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  {success && <p role="status" className="text-sm">{success}</p>}
  {items.length ? <ul className="divide-y border-y">{items.map(item=><li key={item.id} className="space-y-2 py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-xs text-muted-foreground">{item.audience === "MEMBERS" ? "Members" : "Applicants"} · {item._count.notifications} notified</span></div><p className="whitespace-pre-wrap break-words text-sm leading-7">{item.body}</p><time className="block text-xs text-muted-foreground">{new Date(item.publishedAt).toLocaleString()}</time></li>)}</ul> : <p className="rounded-lg border p-8 text-sm text-muted-foreground">No announcements published yet.</p>}
  <Sheet open={compose} onOpenChange={open=>{if(busy) return;if(!open && dirty && !window.confirm("Close this announcement draft?")) return;setCompose(open);}}>
   <SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-xl"><SheetTitle>New announcement</SheetTitle><SheetDescription>Choose the audience and publish a permanent in-app update.</SheetDescription>
   <form className="mt-7 space-y-6" data-unsaved={dirty} onSubmit={e=>{e.preventDefault();if(!busy)setConfirmPublish(true);}}>
    <label className="block space-y-2 text-sm font-medium">Title<Input required disabled={busy} maxLength={200} value={title} onChange={e=>{setTitle(e.target.value);requestKey.current=null;}} /></label>
    <label className="block space-y-2 text-sm font-medium">Recipients<select disabled={busy} className="w-full rounded-md border bg-background p-3" value={audience} onChange={e=>{setAudience(e.target.value as typeof audience);requestKey.current=null;}}><option value="MEMBERS">Current club members</option><option value="APPLICANTS">Submitted applicants</option></select></label>
    <label className="block space-y-2 text-sm font-medium">Announcement<Textarea required disabled={busy} maxLength={10000} className="min-h-56" value={body} onChange={e=>{setBody(e.target.value);requestKey.current=null;}} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy || !title.trim() || !body.trim()}><Send className="size-4" /> {busy?"Publishing…":"Publish in-app announcement"}</Button>
   </form></SheetContent>
  </Sheet>
  <AlertDialog open={confirmPublish} onOpenChange={open=>{if(!busy)setConfirmPublish(open);}}>
   <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Publish this announcement?</AlertDialogTitle><AlertDialogDescription>All eligible {audience.toLowerCase()} will receive an in-app update and optional email according to their preferences.</AlertDialogDescription></AlertDialogHeader>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep editing</AlertDialogCancel><Button disabled={busy} onClick={()=>void publish()}>{busy?"Publishing…":"Confirm publication"}</Button></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </div>;
}
