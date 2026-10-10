"use client";
import { useCallback, useEffect, useState } from "react";
import { getDurableNotifications, setDurableNotificationsRead } from "@/actions/communications";
import { Button } from "@/components/ui/button";
type Payload = Awaited<ReturnType<typeof getDurableNotifications>>;
export function CommunicationsInbox() {
 const [data,setData]=useState<Payload>({items:[],nextCursor:null});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const load=useCallback(async (cursor?:string)=>{
  setBusy(true);
  try { const next=await getDurableNotifications(cursor);setData(p=>cursor?{items:[...p.items,...next.items],nextCursor:next.nextCursor}:next);setError(""); }
  catch(e){setError(e instanceof Error?e.message:"Couldn't load communications.");}
  finally {setBusy(false);}
 },[]);
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener("focus",refresh);return()=>window.removeEventListener("focus",refresh);},[load]);
 async function read(id:string){try{await setDurableNotificationsRead([id],true);setData(p=>({...p,items:p.items.map(n=>n.id===id?{...n,readAt:new Date()}:n)}));}catch{setError("Unable to mark notification as read.");}}
 const unread=data.items.filter(i=>!i.readAt).length;
 return <section aria-label="Club announcements" className="space-y-4">
  <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Club announcements</h2><p className="text-sm text-muted-foreground">Published updates from your clubs · {unread} unread on this page</p></div><Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void load()}>Refresh</Button></div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {data.items.length? <ul className="divide-y border-y">{data.items.map(item=><li key={item.id} className="py-4"><button type="button" onClick={()=>void read(item.id)} className="w-full space-y-2 text-left"><span className="flex flex-wrap justify-between gap-3"><span className="font-medium">{item.title}</span>{!item.readAt&&<span className="text-xs text-primary">Unread</span>}</span><span className="block text-xs text-muted-foreground">{item.club?.name || "OutClass"} · {new Date(item.createdAt).toLocaleString()}</span><span className="block whitespace-pre-wrap break-words text-sm leading-6">{item.body}</span></button></li>)}</ul> : <p className="rounded-lg border px-5 py-8 text-sm text-muted-foreground">{busy?"Loading…":"No published announcements yet."}</p>}
  {data.nextCursor&&<Button variant="outline" type="button" disabled={busy} onClick={()=>void load(data.nextCursor!)}>Load more</Button>}
 </section>;
}
