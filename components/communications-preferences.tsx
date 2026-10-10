"use client";
import { useEffect,useState } from "react";
import { getNotificationPreferences, saveNotificationPreferences } from "@/actions/communications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
type Pref=Awaited<ReturnType<typeof getNotificationPreferences>>;
const fields=[
 ["emailAnnouncements","Club announcements"],
 ["emailMessages","Direct messages (future)"],
 ["emailApplications","Application updates"],
 ["emailInterviews","Interview updates"],
 ["emailInvitations","Club invitations"],
 ["emailTasks","Tasks and deadlines"],
 ["emailPlatform","Optional OutClass news"],
] as const;
export function CommunicationsPreferences(){
 const [prefs,setPrefs]=useState<Pref|null>(null);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{let active=true;getNotificationPreferences().then(p=>{if(active)setPrefs(p)}).catch(()=>{if(active)setMessage("Could not load preferences.")});return()=>{active=false}},[]);
 async function save(){
  if(!prefs)return;setSaving(true);setMessage("");
  try{await saveNotificationPreferences({
   emailAnnouncements:prefs.emailAnnouncements,emailMessages:prefs.emailMessages,
   emailApplications:prefs.emailApplications,emailInterviews:prefs.emailInterviews,
   emailInvitations:prefs.emailInvitations,emailTasks:prefs.emailTasks,
   emailPlatform:prefs.emailPlatform,emailFrequency:prefs.emailFrequency
  });setMessage("Preferences saved. Email delivery for these events is not enabled yet.")}
  catch{setMessage("Could not save preferences.");}finally{setSaving(false)}
 }
 return <section className="space-y-4 border-t pt-6" aria-label="Email notification preferences"><h2 className="text-lg font-semibold">Email notification preferences</h2><p className="text-sm text-muted-foreground">Choose which optional emails you want once notification delivery is enabled. These settings never disable in-app updates or security emails.</p>
  {prefs ? <div className="space-y-4">{fields.map(([key,label])=><label key={key} className="flex items-center gap-3 text-sm"><Checkbox checked={prefs[key]} onCheckedChange={value=>setPrefs(p=>p?{...p,[key]:value===true}:p)} />{label}</label>)}
   <label className="block space-y-2 text-sm">Frequency<select className="block w-full max-w-xs rounded-md border bg-background p-3" value={prefs.emailFrequency} onChange={e=>setPrefs(p=>p?{...p,emailFrequency:e.target.value}:p)}><option value="INSTANT">Instant</option><option value="DAILY">Daily digest</option><option value="OFF">Off</option></select></label>
   <Button disabled={saving} onClick={()=>void save()}>{saving?"Saving…":"Save preferences"}</Button></div> : <p className="text-sm text-muted-foreground">Loading notification settings…</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}
 </section>
}
