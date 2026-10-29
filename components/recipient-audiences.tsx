"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useRef, useState } from "react";
import { academicYear } from "@/lib/recruitment-profile";
import { organizationRoleLabels } from "@/lib/organization-authorization";
import { useDemoMode } from "@/contexts/demo-context";
import { getRecipientGroups, previewRecipientAudience, saveRecipientGroup, deleteRecipientGroup } from "@/actions/recipient-groups";
import { recipientAudienceSchema, type AudienceRule, type RecipientAudience } from "@/lib/recipient-audience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type Catalog = Awaited<ReturnType<typeof getRecipientGroups>>;
type Preview = Awaited<ReturnType<typeof previewRecipientAudience>>;
const initial = (): RecipientAudience => recipientAudienceSchema.parse({ include: [{ source: "MEMBERS" }] });
const sources = { MEMBERS: "Active members", OFFICERS: "Recorded executives / officers", APPLICANTS: "Active applicants (excludes rejected)", REJECTED: "Rejected Applicants", EVENT: "Event audience", LEADS: "Event-engaged leads", GROUP: "Saved group" };
const split = (s: string) => s.split(",").map(v=>v.trim()).filter(Boolean);
function CsvInput({ values, change, placeholder }: { values: (string | number)[]; change: (v: string[])=>void; placeholder?: string }) {
 const serialized=values.join(", "), previous=useRef(serialized);
 const [text,setText]=useState(serialized);
 useEffect(()=>{if(previous.current!==serialized){previous.current=serialized;setText(serialized);}},[serialized]);
 return <Input value={text} placeholder={placeholder} onChange={e=>{const parsed=split(e.target.value);previous.current=parsed.join(", ");setText(e.target.value);change(parsed);}} />;
}
function RuleEditor({ rule, onChange, catalog }: { rule: AudienceRule; onChange: (r: AudienceRule)=>void; catalog: Catalog | null }) {
 const multi = (label: string, values: string[], choices: { value: string; label: string }[], change: (v: string[])=>void) => <label className="block text-sm">{label}<select multiple className="mt-1 w-full rounded border bg-background p-2" value={values} onChange={e=>change(Array.from(e.target.selectedOptions,o=>o.value))}>{choices.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>;
 const patch = (v: object) => onChange({ ...rule, ...v } as AudienceRule);
 return <div className="space-y-3 rounded-lg border p-3">
  <label className="block text-sm">Audience source<select className="mt-1 w-full rounded border bg-background p-2" value={rule.source} onChange={e=>{const source=e.target.value;onChange(source==="GROUP"?{source,groupId:catalog?.groups[0]?.id||""}:source==="EVENT"||source==="LEADS"?{source,eventIds:[],participation:"EITHER",gradYears:[]}:recipientAudienceSchema.parse({include:[{source}]}).include[0]);}}>{Object.entries(sources).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  {"gradYears" in rule && <label className="block text-sm">Graduation years (comma separated; blank means all recorded or missing years)<CsvInput key={rule.source+"years"} values={rule.gradYears} change={v=>patch({gradYears:v.map(Number)})} placeholder="2027, 2028" /></label>}
  {(rule.source==="MEMBERS"||rule.source==="OFFICERS") && <>
   {multi("Access roles",rule.accessRoles,["OWNER","ADMIN","RECRUITING_ADMIN","INTERVIEWER","MEMBER"].map(value=>({value,label:value})),accessRoles=>patch({accessRoles}))}
   <label className="block text-sm">Recorded membership cohorts<CsvInput values={rule.cohorts} change={cohorts=>patch({cohorts})} placeholder={catalog?.cohorts.join(", ")||"No cohort values recorded"} /></label>
   <label className="block text-sm">Existing roster group labels<CsvInput values={rule.labels} change={labels=>patch({labels})} placeholder="Consulting, Finance" /></label>
   <div className="grid gap-3 sm:grid-cols-2">{(["joinedAfter","joinedBefore"] as const).map(key=><label key={key} className="text-sm">{key==="joinedAfter"?"Joined on/after":"Joined on/before"}<Input type="date" value={rule[key]?.slice(0,10)||""} onChange={e=>patch({[key]:e.target.value?`${e.target.value}T${key==="joinedBefore"?"23:59:59.999":"00:00:00.000"}Z`:undefined})} /></label>)}</div>
  </>}
  {(rule.source==="APPLICANTS"||rule.source==="REJECTED") && <>
   {multi("Application recruitment cycles",rule.cycleIds,(catalog?.cycles||[]).map(c=>({value:c.id,label:c.name})),cycleIds=>patch({cycleIds}))}
   {multi("Recruitment rounds",rule.roundIds,(catalog?.rounds||[]).map(r=>({value:r.id,label:r.name})),roundIds=>patch({roundIds}))}
   {rule.source==="APPLICANTS"&&multi("Decision / application statuses",rule.statuses,["SUBMITTED","IN_REVIEW","INTERVIEWING","ACCEPTED","WAITLISTED"].map(value=>({value,label:value})),statuses=>patch({statuses}))}
   <label className="block text-sm">Interview / booking state<select className="w-full rounded border bg-background p-2" value={rule.interview} onChange={e=>patch({interview:e.target.value})}>{["ANY","INTERVIEWING","BOOKED","UNBOOKED","COMPLETED"].map(v=><option key={v}>{v}</option>)}</select></label>
   {multi("Offer statuses",rule.offerStatuses,["NONE","PENDING","ACCEPTED","DECLINED","REVOKED","EXPIRED"].map(value=>({value,label:value})),offerStatuses=>patch({offerStatuses}))}
   <p className="text-xs text-muted-foreground">Cycles use explicit application assignments; unknown legacy cycles remain unassigned. Anonymous-review applicants are excluded; identified applicant access is required.</p>
  </>}
  {(rule.source==="EVENT"||rule.source==="LEADS") && <>
   {multi("Selected club events (required)",rule.eventIds,(catalog?.events||[]).map(e=>({value:e.id,label:e.title})),eventIds=>patch({eventIds}))}
   <label className="block text-sm">Recorded participation<select className="w-full rounded border bg-background p-2" value={rule.participation} onChange={e=>patch({participation:e.target.value})}>{["EITHER","RSVP","ATTENDED"].map(v=><option key={v}>{v}</option>)}</select></label>
  </>}
  {rule.source==="GROUP" && <label className="block text-sm">Saved club group<select className="w-full rounded border bg-background p-2" value={rule.groupId} onChange={e=>patch({groupId:e.target.value})}><option value="">Choose a group</option>{catalog?.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
 </div>;
}
function AdvancedAudienceEditor({ value, onChange, catalog, disabled = false }: { value: RecipientAudience; onChange: (v: RecipientAudience)=>void; catalog: Catalog | null; disabled?: boolean }) {
 return <fieldset disabled={disabled} className="space-y-4">{(["include","exclude"] as const).map(key=><fieldset key={key} className="space-y-3"><legend className="mb-2 text-sm font-semibold">{key==="include"?"Include — match any audience":"Exclude — remove anyone matching"}</legend>{value[key].map((rule,i)=><div key={i} className="space-y-1"><RuleEditor rule={rule} catalog={catalog} onChange={r=>onChange({...value,[key]:value[key].map((old,j)=>j===i?r:old)})} /><Button type="button" size="sm" variant="ghost" disabled={key==="include"&&value.include.length===1} onClick={()=>onChange({...value,[key]:value[key].filter((_,j)=>j!==i)})}>Remove filter</Button></div>)}<Button type="button" variant="outline" size="sm" disabled={value[key].length>=20} onClick={()=>onChange({...value,[key]:[...value[key],initial().include[0]]})}>Add {key} filter</Button></fieldset>)}<p className="text-xs text-muted-foreground">Recipients are deduplicated. Email preferences and channel eligibility are applied separately by canonical delivery. Missing graduation/cohort values never match a specific value.</p></fieldset>;
}
function simpleMode(value: RecipientAudience) {
 const rule = value.include[0];
 if (value.exclude.length || value.include.length !== 1) return "custom";
 if (rule.source === "GROUP") return "groups";
 if (rule.source !== "MEMBERS" || rule.cohorts.length || rule.joinedAfter || rule.joinedBefore) return "custom";
 if ([rule.labels.length, rule.gradYears.length, rule.accessRoles.length].filter(Boolean).length > 1) return "custom";
 if (rule.labels.length) return rule.labels.length === 1 && ["Boys", "Girls"].includes(rule.labels[0]) ? rule.labels[0] : "groups";
 if (rule.gradYears.length && !rule.accessRoles.length) return "year";
 if (rule.accessRoles.length && !rule.gradYears.length) return "role";
 return rule.gradYears.length || rule.accessRoles.length ? "custom" : "everyone";
}
export function AudienceEditor({ value, onChange, catalog, disabled = false }: { value: RecipientAudience; onChange: (v: RecipientAudience) => void; catalog: Catalog | null; disabled?: boolean }) {
 const [chosen, setChosen] = useState<string | null>(null);
 const emitted = useRef<RecipientAudience | null>(null);
 useEffect(() => { if (emitted.current !== value) setChosen(null); }, [value]);
 const emit = (next: RecipientAudience) => { emitted.current = next; onChange(next); };
 const mode = chosen ?? simpleMode(value), rule = value.include[0];
 const memberRule = rule.source === "MEMBERS" ? rule : null;
 const set = (fields: object) => emit(recipientAudienceSchema.parse({ include: Object.values(fields).length && Object.values(fields).every(value => Array.isArray(value) && !value.length) ? [{ source: "PEOPLE", userIds: [] }] : [{ source: "MEMBERS", ...fields }] }));
 function choose(next: string) { setChosen(next); if (next === "everyone") set({}); else if (["Boys", "Girls"].includes(next)) set({ labels: [next] }); else if (next !== "custom") emit(recipientAudienceSchema.parse({ include: [{ source: "PEOPLE", userIds: [] }] })); }
 return <fieldset disabled={disabled} className="space-y-4"><legend className="mb-2 text-sm font-medium">Who is this for?</legend>
  <div role="group" aria-label="Audience shortcuts" className="flex flex-wrap gap-2">{[["everyone", "Everyone"], ["Boys", "Boys"], ["Girls", "Girls"], ["year", "By year"], ["role", "By role"], ["groups", "Groups"], ["custom", "Custom"]].map(([id, label]) => <Button type="button" key={id} variant={mode === id ? "secondary" : "outline"} size="sm" aria-pressed={mode === id} onClick={() => choose(id)}>{label}</Button>)}</div>
  {mode === "everyone" && <p className="text-sm text-muted-foreground">All active club members.</p>}
  {["Boys", "Girls"].includes(mode) && <p className="text-sm text-muted-foreground">Members assigned to the “{mode}” group in Members.</p>}
  {mode === "year" && <div className="flex flex-wrap gap-2" role="group" aria-label="Audience class years">{(catalog?.gradYears ?? []).map(year => <Button type="button" key={year} size="sm" variant={memberRule?.gradYears.includes(year) ? "secondary" : "outline"} aria-pressed={!!memberRule?.gradYears.includes(year)} onClick={() => set({ gradYears: memberRule?.gradYears.includes(year) ? memberRule.gradYears.filter(item => item !== year) : [...(memberRule?.gradYears ?? []), year] })}>{academicYear({ gradYear: year })} · {year}</Button>)}{!catalog?.gradYears?.length && <p className="text-sm text-muted-foreground">No class years are recorded yet.</p>}</div>}
  {mode === "role" && <div className="flex flex-wrap gap-2" role="group" aria-label="Audience roles">{Object.entries(organizationRoleLabels).map(([role, label]) => <Button type="button" key={role} size="sm" variant={memberRule?.accessRoles.includes(role as typeof memberRule.accessRoles[number]) ? "secondary" : "outline"} onClick={() => set({ accessRoles: memberRule?.accessRoles.includes(role as typeof memberRule.accessRoles[number]) ? memberRule.accessRoles.filter(item => item !== role) : [...(memberRule?.accessRoles ?? []), role] })}>{label}</Button>)}</div>}
  {mode === "groups" && <div className="flex flex-wrap gap-2" role="group" aria-label="Audience groups">{(catalog?.rosterLabels ?? []).map(label => <Button key={label} type="button" size="sm" variant={memberRule?.labels.includes(label) ? "secondary" : "outline"} onClick={() => set({ labels: [label] })}>{label}</Button>)}{catalog?.groups.map(group => <Button key={group.id} type="button" size="sm" variant={rule.source === "GROUP" && rule.groupId === group.id ? "secondary" : "outline"} onClick={() => emit(recipientAudienceSchema.parse({ include: [{ source: "GROUP", groupId: group.id }] }))}>{group.name}</Button>)}{!catalog?.rosterLabels?.length && !catalog?.groups.length && <p className="text-sm text-muted-foreground">Assign groups from Members, or create a reusable audience.</p>}</div>}
  {mode === "custom" && <AdvancedAudienceEditor disabled={disabled} value={value} onChange={emit} catalog={catalog} />}
 </fieldset>;
}
export function AudiencePreview({ preview }: { preview: Preview | null }) {
 if(!preview)return null;
 return <div className="space-y-2 rounded-lg border p-3"><p role="status" className="text-sm font-semibold">{preview.count} unique recipient(s)</p><p className="text-xs text-muted-foreground">Evaluated {new Date(preview.evaluatedAt).toLocaleString()}. Publication rechecks current permissions and recipient data.</p><ul className="max-h-60 overflow-y-auto text-sm">{preview.recipients.map(r=><li key={r.id}>{r.studentProfile?`${r.studentProfile.firstName} ${r.studentProfile.lastName} · `:""}{r.email}</li>)}</ul></div>;
}
export function RecipientGroups({ clubId }: { clubId: string }) {
 const demo=useDemoMode();
 const draftId=useRef<string|null>(null);
 const [dirty,setDirty]=useState(false);
 const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState(""),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [editing,setEditing]=useState<Catalog["groups"][number]|null>(null),[name,setName]=useState(""),[kind,setKind]=useState<"MANUAL"|"RULES">("MANUAL"),[spec,setSpec]=useState(initial),[preview,setPreview]=useState<Preview|null>(null),[selected,setSelected]=useState<string[]>([]);
 useEffect(()=>{if(demo.isDemoEnabled)return;let alive=true;getRecipientGroups(clubId).then(c=>{if(alive)setCatalog(c);}).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Groups unavailable.");});return()=>{alive=false;};},[clubId,demo.isDemoEnabled]);
 useEffect(()=>{if(!open||!dirty&&!busy)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[open,dirty,busy]);
 if(demo.isDemoEnabled)return <p>Recipient groups use your live club workspace. Demo never calls live group actions.</p>;
 async function work(fn:()=>Promise<void>){setBusy(true);setError("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"Group operation failed.");}finally{setBusy(false);}}
 async function edit(group: Catalog["groups"][number]|null){setDirty(false);draftId.current=group?.id||crypto.randomUUID();setEditing(group);setName(group?.name||"");setKind(group?.kind==="RULES"?"RULES":"MANUAL");setSpec(group?.kind==="RULES"?recipientAudienceSchema.parse(group.rules):initial());setPreview(null);setSelected([]);if(group?.kind==="MANUAL"){const p=await previewRecipientAudience(clubId,{include:[{source:"GROUP",groupId:group.id}]});setPreview(p);setSelected(p.recipients.map(r=>r.id));}setOpen(true);}
 return <section className="space-y-4 rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Recipient groups</h3><p className="text-sm text-muted-foreground">Consulting, Finance, teams, committees, or reusable audience rules.</p></div><Button disabled={busy} variant="outline" onClick={()=>void work(async()=>setCatalog(await getRecipientGroups(clubId)))}>Refresh groups</Button>{catalog?.canEdit&&<Button disabled={busy} variant="outline" onClick={()=>void work(()=>edit(null))}>New group</Button>}</div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {!catalog&&!error&&<LoadingState label="Loading recipient groups…" layout="rows" rows={3} />}{catalog&&!catalog.groups.length&&<p className="text-sm text-muted-foreground">No recipient groups yet. Create a group to reuse a selection or audience rule.</p>}
  <ul className="space-y-2">{catalog?.groups.map(g=><li key={g.id} className="flex flex-wrap items-center gap-3"><span className="mr-auto">{g.name} <small className="text-muted-foreground">{g.kind==="MANUAL"?"Manual":"Rule-based"}</small></span><Button size="sm" variant="ghost" disabled={busy} onClick={()=>void work(async()=>{setPreview(await previewRecipientAudience(clubId,{include:[{source:"GROUP",groupId:g.id}]}));})}>Preview</Button>{catalog.canEdit&&<><Button size="sm" variant="outline" disabled={busy} onClick={()=>void work(()=>edit(g))}>Edit</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>{if(window.confirm(`Delete group ${g.name}? Student accounts and published notifications are preserved.`))void work(async()=>{await deleteRecipientGroup(clubId,g.id,g.revision);setCatalog(await getRecipientGroups(clubId));setPreview(null);});}}>Delete</Button></>}</li>)}</ul>{!open&&<AudiencePreview preview={preview} />}
  <Sheet open={open} onOpenChange={v=>{if(busy)return;if(!v&&dirty&&!window.confirm("Discard unsaved audience group changes?"))return;setOpen(v);}}><SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-2xl"><SheetTitle>{editing?"Edit":"Create"} recipient group</SheetTitle><SheetDescription>Only active authorized club managers can edit groups. Groups never change student accounts or email preferences.</SheetDescription><form data-saving={busy} data-unsaved={dirty} onChangeCapture={()=>setDirty(true)} className="mt-5 space-y-5" onSubmit={e=>{e.preventDefault();void work(async()=>{await saveRecipientGroup({clubId,id:editing?.id||draftId.current,revision:editing?.revision??null,name,kind,...(kind==="MANUAL"?{userIds:selected}:{rules:spec})});setCatalog(await getRecipientGroups(clubId));setDirty(false);setOpen(false);setPreview(null);});}}>
   <label className="block text-sm">Group name<Input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} /></label><label className="block text-sm">Group membership<select className="w-full rounded border bg-background p-2" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setPreview(null);}}><option value="MANUAL">Manual — select recorded people</option><option value="RULES">Rules — reevaluate current records</option></select></label>
   <AudienceEditor disabled={busy} value={spec} onChange={v=>{setDirty(true);setSpec(v);setPreview(null);}} catalog={catalog} /><Button disabled={busy} variant="outline" type="button" onClick={()=>void work(async()=>setPreview(await previewRecipientAudience(clubId,spec)))}>Preview {kind==="MANUAL"?"people to add":"rule audience"}</Button>
   {kind==="MANUAL"&&<><Button variant="outline" type="button" disabled={!preview?.recipients.length} onClick={() => { setDirty(true); setSelected([...new Set([...selected, ...(preview?.recipients.map(person => person.id) ?? [])])]); }}>Select everyone in preview</Button><p className="text-sm">{selected.length} selected. Preview additional audiences to add people; selections are kept across previews.</p><div className="max-h-64 overflow-y-auto">{preview?.recipients.map(r=><label key={r.id} className="flex gap-2 py-1 text-sm"><input type="checkbox" checked={selected.includes(r.id)} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,r.id])]:selected.filter(id=>id!==r.id))} />{r.email}</label>)}</div><Button variant="ghost" type="button" onClick={()=>{setDirty(true);setSelected([])}}>Clear all selections</Button></>}
   {kind==="RULES"&&<AudiencePreview preview={preview} />}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy||!name.trim()} type="submit">Save group</Button>
  </form></SheetContent></Sheet>
 </section>;
}
