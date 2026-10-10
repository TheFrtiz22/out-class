"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getClubAnnouncements, publishClubAnnouncement } from "@/actions/communications";
type Item = Awaited<ReturnType<typeof getClubAnnouncements>>[number];

export function ClubAnnouncements({ clubId }: { clubId: string }) {
 const [items, setItems] = useState<Item[]>([]);
 const [busy, setBusy] = useState(false);
 const [compose, setCompose] = useState(false);
 const [title, setTitle] = useState("");
 const [body, setBody] = useState("");
 const [audience, setAudience] = useState<"MEMBERS" | "APPLICANTS">("MEMBERS");
 const [error, setError] = useState("");
 const [success, setSuccess] = useState("");
 const dirty = compose && (!!title.trim() || !!body.trim());
 const reload = useCallback(async () => {
  try { setItems(await getClubAnnouncements(clubId)); }
  catch (e) { setError(e instanceof Error ? e.message : "Could not load announcements."); }
 }, [clubId]);
 useEffect(() => { void reload(); }, [reload]);
 useEffect(() => {
  if (!dirty) return;
  const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
  window.addEventListener("beforeunload",warn);
  return () => window.removeEventListener("beforeunload",warn);
 }, [dirty]);
 async function publish(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  if (busy || !window.confirm("Publish to all eligible " + audience.toLowerCase() + "? This will create in-app notifications. No emails will be sent yet.")) return;
  setBusy(true); setError(""); setSuccess("");
  try {
   const result = await publishClubAnnouncement({ clubId, title, body, audience });
   setSuccess("Published to " + result.recipientCount + " recipient(s) in their in-app notifications. No email was sent.");
   setTitle(""); setBody(""); setCompose(false); await reload();
  } catch (e) { setError(e instanceof Error ? e.message : "Publishing failed."); }
  finally { setBusy(false); }
 }
 return <div className="max-w-5xl space-y-7">
  <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="oc-section-heading">Announcements</h2><p className="mt-2 text-sm text-muted-foreground">Publish to your club’s current members or submitted applicants.</p></div><Button onClick={()=>{setCompose(true);setError("");setSuccess("");}}><Plus className="size-4" /> New announcement</Button></div>
  <p className="border-l-2 border-brand-orange pl-4 text-sm text-muted-foreground">Initial release: publishing creates durable in-app notifications only. Email delivery and direct messaging are not available yet.</p>
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  {success && <p role="status" className="text-sm">{success}</p>}
  {items.length ? <ul className="divide-y border-y">{items.map(item=><li key={item.id} className="space-y-2 py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-xs text-muted-foreground">{item.audience === "MEMBERS" ? "Members" : "Applicants"} · {item._count.notifications} notified</span></div><p className="whitespace-pre-wrap break-words text-sm leading-7">{item.body}</p><time className="block text-xs text-muted-foreground">{new Date(item.publishedAt).toLocaleString()}</time></li>)}</ul> : <p className="rounded-lg border p-8 text-sm text-muted-foreground">No announcements published yet.</p>}
  <Sheet open={compose} onOpenChange={open=>{if(!open && dirty && !window.confirm("Discard this announcement draft?")) return;setCompose(open);}}>
   <SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-xl"><SheetTitle>New announcement</SheetTitle><SheetDescription>Choose the audience and publish a permanent in-app update.</SheetDescription>
   <form className="mt-7 space-y-6" data-unsaved={dirty} onSubmit={publish}>
    <label className="block space-y-2 text-sm font-medium">Title<Input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} /></label>
    <label className="block space-y-2 text-sm font-medium">Recipients<select className="w-full rounded-md border bg-background p-3" value={audience} onChange={e=>setAudience(e.target.value as typeof audience)}><option value="MEMBERS">Current club members</option><option value="APPLICANTS">Submitted applicants</option></select></label>
    <label className="block space-y-2 text-sm font-medium">Announcement<Textarea required maxLength={10000} className="min-h-56" value={body} onChange={e=>setBody(e.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy || !title.trim() || !body.trim()}><Send className="size-4" /> {busy?"Publishing…":"Publish in-app announcement"}</Button>
   </form></SheetContent>
  </Sheet>
 </div>;
}
