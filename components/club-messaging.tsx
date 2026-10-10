"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageSquare, Plus, Search, Send } from "lucide-react";
import { findCommunicationRecipients, getClubConversation, getMessagingClubs, listClubConversations, sendClubMessage, startClubConversation } from "@/actions/communications";
import { useDemoMode } from "@/contexts/demo-context";
import { useApplicationState } from "@/lib/application-state";
import { communicationsChanged } from "@/lib/communications-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Conversation = Awaited<ReturnType<typeof listClubConversations>>[number];
type Thread = Awaited<ReturnType<typeof getClubConversation>>;
type Recipient = Awaited<ReturnType<typeof findCommunicationRecipients>>[number];
export function ClubMessaging({ clubId }: { clubId?: string }) {
  const demo = useDemoMode(), params = useSearchParams();
  const { notifications, setNotificationsRead } = useApplicationState();
  const [conversations, setConversations] = useState<Conversation[]>([]), [selected, setSelected] = useState<string | null>(params.get("conversation"));
  const [thread, setThread] = useState<Thread | null>(null), [loading, setLoading] = useState(true), [opening, setOpening] = useState(false), [sending, setSending] = useState(false);
  const [error, setError] = useState(""), [drafts, setDrafts] = useState<Record<string, string>>({});
  const [compose, setCompose] = useState(false), [subject, setSubject] = useState(""), [clubs, setClubs] = useState<Awaited<ReturnType<typeof getMessagingClubs>>>([]), [targetClub, setTargetClub] = useState(clubId || "");
  const [query, setQuery] = useState(""), [recipients, setRecipients] = useState<Recipient[]>([]), [recipient, setRecipient] = useState<Recipient | null>(null), [searching, setSearching] = useState(false);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const requestKeys = useRef<Record<string, string>>({}), listRequest = useRef(0), threadRequest = useRef(0), searchRequest = useRef(0);
  const draft = selected ? drafts[selected] || "" : "";
  const dirty = !!draft.trim() || compose && !!subject.trim();
  const reload = useCallback(async () => {
    if (demo.isDemoEnabled) { setLoading(false); return; }
    const request = ++listRequest.current;
    try { const rows = await listClubConversations(clubId); if (request === listRequest.current) { setConversations(rows); setError(""); } }
    catch { if (request === listRequest.current) { setConversations([]); setError("Could not open messages. Check your access and try again."); } }
    finally { if (request === listRequest.current) setLoading(false); }
  }, [clubId, demo.isDemoEnabled]);
  const loadThread = useCallback(async (id: string, before?: string) => {
    if (demo.isDemoEnabled) return;
    const request = ++threadRequest.current;
    setOpening(true);
    try {
      const result = await getClubConversation(id, before);
      if (request !== threadRequest.current || selectedRef.current !== id) return;
      setThread(previous => before && previous?.id === id ? { ...result, items: [...result.items, ...previous.items].filter((item, index, all) => all.findIndex(row => row.id === item.id) === index) } : previous?.id === id && previous.items.length > 50 ? { ...result, nextCursor: previous.nextCursor, items: [...previous.items.filter(item => !result.items.some(row => row.id === item.id)), ...result.items] } : result);
      setError("");
    } catch { if (request === threadRequest.current && selectedRef.current === id) { setThread(null); setError("This conversation is unavailable with your current access. Your draft is kept until you leave this page."); } }
    finally { if (request === threadRequest.current) setOpening(false); }
  }, [demo.isDemoEnabled]);
  useEffect(() => { void reload(); return () => { listRequest.current++; }; }, [reload]);
  useEffect(() => { if (selected) void loadThread(selected); else setThread(null); return () => { threadRequest.current++; }; }, [selected, loadThread]);
  useEffect(() => {
    const refresh = () => { void reload(); if (selectedRef.current) void loadThread(selectedRef.current); };
    window.addEventListener("outclass:communications-refresh", refresh);
    return () => window.removeEventListener("outclass:communications-refresh", refresh);
  }, [reload, loadThread]);
  useEffect(() => {
    if (!thread) return;
    const ids = notifications.filter(n => !n.read && n.durableId && n.href?.includes(`conversation=${thread.id}`)).map(n => n.id);
    if (ids.length) setNotificationsRead(ids, true);
  }, [thread, notifications, setNotificationsRead]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function newConversation() {
    setCompose(true); setError("");
    if (!clubId) try { const result = await getMessagingClubs(); setClubs(result); setTargetClub(result[0]?.id || ""); } catch { setError("Could not load your clubs. Try again."); }
  }
  async function search() {
    if (!clubId || query.trim().length < 2) return;
    const request = ++searchRequest.current;
    setSearching(true); setRecipient(null);
    try { const result = await findCommunicationRecipients(clubId, query); if (request === searchRequest.current) setRecipients(result); }
    catch { if (request === searchRequest.current) setError("Could not search eligible recipients."); }
    finally { if (request === searchRequest.current) setSearching(false); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (sending) return;
    setSending(true); setError("");
    try {
      const result = await startClubConversation({ clubId: targetClub, subject, ...(clubId && recipient ? { studentId: recipient.id } : {}) });
      setSelected(result.id); setCompose(false); setSubject(""); setRecipient(null); setRecipients([]); setQuery(""); await reload();
    } catch { setError("Could not start this conversation. Choose a currently eligible recipient."); }
    finally { setSending(false); }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (!selected || sending || !draft.trim()) return;
    const id = selected, body = draft, key = requestKeys.current[id] ||= crypto.randomUUID();
    setSending(true); setError("");
    try {
      await sendClubMessage({ conversationId: id, body, requestKey: key });
      delete requestKeys.current[id]; setDrafts(previous => ({ ...previous, [id]: "" }));
      if (selectedRef.current === id) await loadThread(id);
      communicationsChanged(); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send. Your draft is saved on this page; try again."); }
    finally { setSending(false); }
  }
  if (demo.isDemoEnabled) return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Private messaging is available when signed into your live OutClass account.</p>;
  return <section aria-label="Private club messages" className="space-y-4" data-unsaved={dirty} data-saving={sending}>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="oc-section-heading">Messages</h2><p className="mt-2 text-sm text-muted-foreground">A private conversation with {clubId ? "your club’s members and eligible applicants" : "your club’s team"}.</p></div><Button onClick={() => void newConversation()}><Plus aria-hidden="true" className="size-4" />New conversation</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}<Button variant="link" onClick={() => { void reload(); if (selected) void loadThread(selected); }}>Retry</Button></p>}
    <div className="grid min-h-[28rem] overflow-hidden rounded-lg border bg-card md:grid-cols-[minmax(220px,32%)_minmax(0,1fr)]">
      <nav aria-label="Conversations" className={cn("border-r", selected && "hidden md:block")}>
        {loading ? <p role="status" className="p-6 text-sm text-muted-foreground">Loading conversations…</p> : conversations.length ? <ul className="divide-y">{conversations.map(item => {
          const unread = notifications.some(n => !n.read && n.href?.includes(`conversation=${item.id}`));
          return <li key={item.id}><button type="button" aria-current={selected === item.id ? "true" : undefined} onClick={() => setSelected(item.id)} className={cn("w-full space-y-2 p-5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring", selected === item.id && "bg-accent")}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{item.name}</span>{unread && <span className="shrink-0 text-xs text-brand-orange">New</span>}</span><span className="block truncate text-sm">{item.subject}</span><time className="block text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString()}</time></button></li>;
        })}</ul> : <div className="p-6 text-sm leading-6 text-muted-foreground"><MessageSquare aria-hidden="true" className="mb-3 size-6" /><p>No conversations yet. Start with a question or a quick hello.</p></div>}
      </nav>
      <div className={cn("flex min-w-0 flex-col", !selected && "hidden md:flex")}>
        {selected ? <>
          <header className="flex items-center gap-3 border-b p-4"><Button variant="ghost" size="icon" aria-label="Back to conversations" className="md:hidden" onClick={() => setSelected(null)}><ArrowLeft /></Button><div className="min-w-0"><h3 className="break-words font-semibold">{thread?.subject || "Conversation"}</h3><p className="mt-1 text-xs text-muted-foreground">Only you and the club’s authorized team can read this conversation.</p></div></header>
          <div role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions" className="flex max-h-[55dvh] min-h-64 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            {thread?.nextCursor && <Button className="mx-auto" size="sm" variant="outline" disabled={opening} onClick={() => void loadThread(selected, thread.nextCursor!)}>Load older messages</Button>}
            {!thread && opening ? <p role="status" className="text-sm text-muted-foreground">Opening conversation…</p> : thread?.items.length ? thread.items.map(message => <article key={message.id} className={cn("max-w-[90%] rounded-lg border px-4 py-3 sm:max-w-[80%]", message.isMine ? "ml-auto border-primary/15 bg-accent" : "mr-auto bg-background")}><p className="mb-2 text-xs font-medium text-muted-foreground">{message.isMine ? "You" : message.senderKind === "CLUB" ? "Club team" : "Student"}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{message.body}</p><time className="mt-2 block text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</time></article>) : thread && <p className="text-sm text-muted-foreground">Say hello. Your message will appear here once it is sent.</p>}
          </div>
          <form className="space-y-3 border-t p-4" onSubmit={send}><label className="sr-only" htmlFor="club-message-body">Your message</label><Textarea id="club-message-body" value={draft} maxLength={10000} disabled={!thread || sending} placeholder="Write a message…" className="min-h-24 resize-y" onChange={e => { if (!selected) return; setDrafts(previous => ({ ...previous, [selected]: e.target.value })); delete requestKeys.current[selected]; }} /><div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{draft.length.toLocaleString()} / 10,000</p><Button type="submit" disabled={!thread || sending || !draft.trim()}><Send aria-hidden="true" className="size-4" />{sending ? "Sending…" : "Send message"}</Button></div></form>
        </> : <div className="m-auto max-w-sm p-8 text-center"><MessageSquare aria-hidden="true" className="mx-auto mb-4 size-8 text-muted-foreground" /><h3 className="font-semibold">Keep the conversation going.</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">Choose a conversation or reach out to a club team.</p></div>}
      </div>
    </div>
    <Sheet open={compose} onOpenChange={open => { if (sending) return; if (!open && subject.trim() && !window.confirm("Close this conversation draft?")) return; setCompose(open); }}><SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-xl"><SheetTitle>New conversation</SheetTitle><SheetDescription>{clubId ? "Choose an active member or an identified submitted applicant." : "Contact a club where you are a member or eligible applicant."}</SheetDescription><form className="mt-7 space-y-6" onSubmit={create}>
      {clubId ? <div className="space-y-3"><label htmlFor="message-recipient" className="text-sm font-medium">Find a recipient</label><div className="flex gap-2"><Input id="message-recipient" value={query} placeholder="Name or university email" onChange={e => { setQuery(e.target.value); setRecipient(null); setRecipients([]); searchRequest.current++; }} /><Button type="button" variant="outline" aria-label="Search eligible recipients" disabled={searching || query.trim().length < 2} onClick={() => void search()}><Search aria-hidden="true" className="size-4" /></Button></div><ul className="max-h-60 overflow-auto rounded border">{recipients.map(item => <li key={item.id}><button type="button" aria-pressed={recipient?.id === item.id} className={cn("min-h-11 w-full p-3 text-left text-sm hover:bg-muted", recipient?.id === item.id && "bg-accent")} onClick={() => setRecipient(item)}>{item.studentProfile ? `${item.studentProfile.firstName} ${item.studentProfile.lastName}` : item.email}<span className="block text-xs text-muted-foreground">{item.email}</span></button></li>)}</ul>{!searching && query.length >= 2 && !recipients.length && <p className="text-xs text-muted-foreground">Search to find eligible recipients. Anonymous applicants are excluded.</p>}</div> : <label className="block space-y-2 text-sm font-medium">Club<select required className="min-h-11 w-full rounded-md border bg-background px-3" value={targetClub} onChange={e => setTargetClub(e.target.value)}>{clubs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!clubs.length && <span className="block text-xs text-muted-foreground">Join a club or submit an eligible application to start messaging.</span>}</label>}
      <label className="block space-y-2 text-sm font-medium">Subject<Input required value={subject} maxLength={200} onChange={e => setSubject(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={sending || !subject.trim() || !targetClub || !!clubId && !recipient}>{sending ? "Opening…" : "Start conversation"}</Button>
    </form></SheetContent></Sheet>
  </section>;
}
