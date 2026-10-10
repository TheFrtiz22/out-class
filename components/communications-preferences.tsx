"use client";
import { useEffect,useState } from "react";
import { getNotificationPreferences, saveNotificationPreferences } from "@/actions/communications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
type Pref=Awaited<ReturnType<typeof getNotificationPreferences>>;
const fields=[
 ["emailAnnouncements","Club announcements"],
 ["emailMessages","Private messages"],
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
 const [dirty,setDirty]=useState(false), [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;getNotificationPreferences().then(p=>{if(active){setPrefs(p);setMessage("")}}).catch(()=>{if(active)setMessage("Could not load preferences.")});return()=>{active=false}},[retry]);
 async function save(){
  if(!prefs)return;setSaving(true);setMessage("");
  try{await saveNotificationPreferences({
   emailAnnouncements:prefs.emailAnnouncements,emailMessages:prefs.emailMessages,
   emailApplications:prefs.emailApplications,emailInterviews:prefs.emailInterviews,
   emailInvitations:prefs.emailInvitations,emailTasks:prefs.emailTasks,
   emailPlatform:prefs.emailPlatform,emailFrequency:prefs.emailFrequency
  });setDirty(false);setMessage("Preferences saved.")}
  catch{setMessage("Could not save preferences.");}finally{setSaving(false)}
 }
 return <section className="max-w-2xl space-y-6" data-unsaved={dirty} data-saving={saving} aria-label="Email notification preferences"><h2 className="oc-section-heading">Email notification preferences</h2><p className="text-sm leading-7 text-muted-foreground">Choose the updates you want by email. In-app updates and security emails are always available. Daily summaries are prepared after midnight UTC.</p>
  {prefs ? <div className="space-y-4">{fields.map(([key,label])=><label key={key} className="flex min-h-11 items-center gap-3 rounded-md border px-4 py-3 text-sm"><Checkbox disabled={saving} checked={prefs[key]} onCheckedChange={value=>{setDirty(true);setPrefs(p=>p?{...p,[key]:value===true}:p)}} />{label}</label>)}
   <label className="block space-y-2 text-sm">Frequency<select disabled={saving} className="block w-full max-w-xs rounded-md border bg-background p-3" value={prefs.emailFrequency} onChange={e=>{setDirty(true);setPrefs(p=>p?{...p,emailFrequency:e.target.value}:p)}}><option value="INSTANT">Instant</option><option value="DAILY">Daily digest</option><option value="OFF">Off</option></select></label>
   <Button disabled={saving} onClick={()=>void save()}>{saving?"Saving…":"Save preferences"}</Button></div> : <p className="text-sm text-muted-foreground">Loading notification settings…</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  {!prefs && message && <Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Retry</Button>}
 </section>
}
