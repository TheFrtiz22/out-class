"use client";
import { MeetingGroupInvitation } from "@/components/meeting-group-invitation"
import { useEditorDraft } from "@/hooks/use-editor-draft"
import { AutosaveStatus } from "@/components/ui/autosave-status"

import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { NativeSelect } from "@/components/ui/native-select"
import "@/components/shell/responsive-workspace.css"
import Link from "next/link";
import { ActionWorkflow } from "@/components/product/action-workflow";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { flushEditors } from "@/lib/autosave-navigation";
import { meetingIsUpcoming, meetingDate } from "@/lib/meeting-presentation";
import { CalendarDays, MapPin, ArrowRight, Plus } from "@/components/icons";
import { useEffect, useState } from "react";
import { useDemoMode } from "@/contexts/demo-context";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/permissions";
import {
  listMeetings,
  saveMeeting,
  getMeeting,
  issueMeetingCheckIn,
  closeMeetingCheckIn,
  meetingAttendance,
} from "@/lib/workspace-api";
import { meetingInputSchema, resourceSchema } from "@/lib/meetings";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
type Meeting = Awaited<ReturnType<typeof getMeeting>>;
const localDate = (date: Date) => {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
};
export function MeetingList({ clubId, embedded = false, initialAudience = "ALL", personalOnly = false }: { clubId?: string; embedded?: boolean; initialAudience?: string; personalOnly?: boolean }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [period, setPeriod] = useState<"upcoming" | "past">("upcoming"),
    [audience, setAudience] = useState(initialAudience),
    [refresh, setRefresh] = useState(0), [activeId, setActiveId] = useState<string | null>(null), [notice, setNotice] = useState("");
  useEffect(() => {
    let current = true;
    setLoading(true);
    setMeetings([]);
    setError("");
    listMeetings(clubId)
      .then((value) => {
        if (current) setMeetings(value);
      })
      .catch(() => {
        if (current)
          setError("Could not load meetings. Please sign in and try again.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [clubId, refresh]);
  const { user } = useAuth(),
    member = user?.memberships.find((m) => m.clubId === clubId);
  const visible = meetings.filter(m => (audience === "ALL" || m.audience === audience) && meetingIsUpcoming(m) === (period === "upcoming")).sort((a, b) => (period === "upcoming" ? 1 : -1) * (+new Date(a.date) - +new Date(b.date)));
  return <section className="oc-workspace-stack max-w-5xl">
    {!embedded && <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading ">Club meetings</h2><Link className="text-sm underline" href="/meetings">All available meetings</Link></div>}
    <div className="flex flex-wrap items-start justify-between gap-4"><p className="max-w-xl text-sm leading-7 text-muted-foreground">Agendas, resources, and attendance for your club.</p>
      {!personalOnly && clubId && hasPermission(member, "meetings.manage") && <MeetingCreateAction clubId={clubId} onSaved={() => { setPeriod("upcoming"); setAudience("ALL"); setNotice("Meeting created."); setRefresh(v => v + 1) }} />}
    </div>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
      <div role="group" aria-label="Meeting time" className="flex gap-1">{(["upcoming", "past"] as const).map(value => <Button key={value} variant={period === value ? "secondary" : "ghost"} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === "upcoming" ? "Upcoming" : "Past"}</Button>)}</div>
      <label className="flex items-center gap-3 text-sm">Audience<NativeSelect className="min-h-11 max-w-full rounded-md border bg-card px-3" value={audience} onChange={e => setAudience(e.target.value)}><option value="ALL">All permitted meetings</option><option value="RECRUITMENT">Recruitment / Interest</option><option value="MEMBERS">Members</option></NativeSelect></label>
    </div>

    {loading && <LoadingState label="Loading meetings…" layout="schedule" rows={3} />}
    {error && <div role="alert" className="oc-feedback"><p>{error}</p><Button variant="outline" onClick={() => setRefresh(v => v + 1)}>Retry</Button></div>}
    {!loading && !error && !visible.length && <EmptyState density="compact" align="start" title={`No ${period} meetings for this audience`} description={period === "upcoming" ? "Check Past for earlier agendas and recaps." : "Shared meeting history will appear here."} />}
    <ul className="grid gap-3">{visible.map(meeting => <li key={meeting.id} className="min-w-0">
      <button type="button" onClick={() => setActiveId(meeting.id)} className="oc-content-panel group flex w-full text-left gap-4 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-6"><CalendarDays aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{!clubId && `${meeting.club.name} · `}{meeting.audience === "MEMBERS" ? "Members" : "Recruitment / Interest"}</p><h3 className="oc-card-heading mt-2 break-words">{meeting.title}</h3><p className="mt-3 text-sm">{meetingDate(meeting.date)}{meeting.endDate && ` — ${meetingDate(meeting.endDate)}`}</p><p className="mt-2 flex items-start gap-2 break-words text-sm text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{meeting.location}</p><p className="mt-4 text-xs text-muted-foreground">{meeting.recap?.trim() ? "Recap available · " : ""}Open agenda, resources & attendance</p></div><ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0" /></button>
      {!personalOnly && hasPermission(user?.memberships.find(m => m.clubId === meeting.clubId), "meetings.attendance") && <MeetingAttendanceState key={`${meeting.id}:${refresh}`} meeting={meeting} />}
    </li>)}</ul>
    <Sheet open={!!activeId} onOpenChange={open => { if (!open && !document.querySelector('[data-saving="true"]')) void flushEditors().then(() => setActiveId(null)).catch(() => {}) }}><SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-3xl"><SheetTitle className="sr-only">Meeting details</SheetTitle><SheetDescription className="sr-only">Agenda, resources, and attendance.</SheetDescription>{activeId && <MeetingDetail id={activeId} onUpdated={() => { setRefresh(value => value + 1); setNotice("Meeting updated.") }} />}</SheetContent></Sheet>
  </section>;
}
export function MeetingCreateAction({ clubId, onSaved }: { clubId: string; onSaved?: () => void }) {
  const [notice, setNotice] = useState("");
  return <div className="space-y-2"><ActionWorkflow showCloseAction={false} title="New meeting" description="Choose a time, place, and audience. Add an agenda or resources when you’re ready." trigger={<><Plus size={16} />New meeting</>} variant="default">{done => <MeetingEditor clubId={clubId} onCancel={done} onSaved={() => { done(); setNotice("Meeting created."); onSaved?.() }} />}</ActionWorkflow>{!onSaved && notice && <p role="status" className="text-xs">{notice}</p>}</div>;
}

/** Fetch the existing permission-checked roster only on request; list browsing does not fan out roster queries. */
function MeetingAttendanceState({ meeting }: { meeting: Meeting }) {
  const [count, setCount] = useState<number | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  return <div className="mt-2 flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground"><span role="status">{error ? "Attendance unavailable." : count === null ? "Attendance not loaded" : `${count} recorded check-in${count === 1 ? "" : "s"}`}</span><Button size="sm" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); setError(false); try { const rows = await meetingAttendance(meeting.clubId, meeting.id); setCount(rows.length) } catch { setCount(null); setError(true) } finally { setBusy(false) } }}>{busy ? "Loading…" : count === null ? "Check attendance" : "Refresh attendance"}</Button></div>;
}

function MeetingEditor({
  clubId,
  meeting,
  onSaved,
  onCancel,
}: {
  clubId: string;
  meeting?: Meeting;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  const initial = resourceSchema.array().safeParse(meeting?.resources || []);
  const [resources, setResources] = useState(
    initial.success ? initial.data : [],
  );
  const [fields,setFields] = useState(() => ({ title: meeting?.title ?? "", description: meeting?.description ?? "", date: localDate(meeting ? new Date(meeting.date) : new Date()), endDate: meeting?.endDate ? localDate(new Date(meeting.endDate)) : "", location: meeting?.location ?? "", audience: meeting?.audience ?? "RECRUITMENT", agenda: meeting?.agenda ?? "", recap: meeting?.recap ?? "" }));
  const draftSave = useEditorDraft({ scope: { kind: "meeting", clubId, resourceId: meeting?.id ?? "new" }, value: { fields,resources }, restore: d=>{setFields(d.fields);setResources(d.resources)}, base: meeting ? String(meeting.revision) : "new" });
  const [tab, setTab] = useState("details");
  const change = (key: keyof typeof fields, value: string) => setFields(current=>({...current,[key]:value}));
  return (
    <form data-saving={busy} data-autosave-editor="true" onBlur={draftSave.onBlur} data-unsaved={draftSave.dirty}
      className="space-y-4 py-4"
      onInvalidCapture={event => { const field = event.target as HTMLElement; if (field.closest('section[hidden]')) setTab("resources"); else if (field.closest('div[hidden]')) setTab("details") }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage(""); setFailed(false);
        try {
          const input = meetingInputSchema.safeParse({ ...fields, id: meeting?.id, clubId, resources, revision: meeting?.revision ?? 0, endDate: fields.endDate || null });
          if (!input.success) throw new Error(input.error.issues[0].message);
          await draftSave.flush();
          await saveMeeting({
            id: meeting?.id,
            clubId,
            title: fields.title,
            description: fields.description,
            date: new Date(fields.date),
            endDate: fields.endDate
              ? new Date(fields.endDate)
              : null,
            location: fields.location,
            audience: fields.audience,
            agenda: fields.agenda,
            recap: fields.recap,
            resources,
            revision: meeting?.revision || 0,
          });
          await draftSave.clear();
          setMessage("Meeting published.");
          if (!meeting) {
            setFields(current=>({...current,title:"",description:"",location:"",agenda:"",recap:""}));
            setResources([]);
          }
          onSaved();
        } catch (error) {
          setFailed(true);
          setMessage(
            error instanceof Error ? error.message : "Could not save.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <AutosaveStatus save={draftSave} />
      <div role="group" aria-label="Meeting editor sections" className="flex flex-wrap gap-1 border-b pb-3">{[["details", "Details"], ["content", "Description & agenda"], ["resources", "Resources"]].map(([id, label]) => <Button key={id} type="button" variant={tab === id ? "secondary" : "ghost"} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</Button>)}</div>
      <fieldset disabled={busy || !draftSave.ready || draftSave.recovery != null} className="space-y-4">
        <div hidden={tab !== "details"} className="space-y-4">
        <label className="block">
          Title
          <Input
            name="title"
            required
            maxLength={200}
            value={fields.title} onChange={e=>change("title",e.target.value)}
          />
        </label>
        <label className="block">
          Audience
          <NativeSelect
            name="audience"
            value={fields.audience} onChange={e=>change("audience",e.target.value)}
            className="ml-3 rounded border p-2"
          >
            <option value="RECRUITMENT">Recruitment / Interest</option>
            <option value="MEMBERS">Members</option>
          </NativeSelect>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Starts (your local time)
            <Input
              name="date"
              type="datetime-local"
              required
              value={fields.date} onChange={e=>change("date",e.target.value)}
            />
          </label>
          <label>
            Ends (optional)
            <Input
              name="endDate"
              type="datetime-local"
              value={fields.endDate} onChange={e=>change("endDate",e.target.value)}
            />
          </label>
        </div>
        <label className="block">
          Location
          <Input
            name="location"
            required
            maxLength={500}
            value={fields.location} onChange={e=>change("location",e.target.value)}
          />
        </label>
        </div>
        <div hidden={tab !== "content"} className="space-y-4">
        {(["description", "agenda", ...(meeting ? ["recap" as const] : [])] as const).map((key) => (
          <label className="block capitalize" key={key}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
            <Textarea
              name={key}
              rows={4}
              maxLength={key === "description" ? 10000 : 20000}
              value={fields[key]} onChange={e=>change(key,e.target.value)}
            />
          </label>
        ))}
        </div>
        <section hidden={tab !== "resources"} className="space-y-3">
          <h3 className="oc-card-heading ">Slides, files, and links</h3>
          <p className="text-xs text-muted-foreground">
            Attach links to resources. For member-only documents, also restrict
            sharing with your file provider.
          </p>
          {resources.map((r, i) => (
            <div key={r.id} className="space-y-2 border-l pl-3">
              <label className="block text-sm">
                Resource label
                <Input
                  required
                  value={r.label}
                  onChange={(e) =>
                    setResources(
                      resources.map((v) =>
                        v.id === r.id ? { ...v, label: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Resource / file URL
                <Input
                  required
                  type="url"
                  value={r.url}
                  onChange={(e) =>
                    setResources(
                      resources.map((v) =>
                        v.id === r.id ? { ...v, url: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Type{" "}
                <NativeSelect
                  className="rounded border p-2"
                  value={r.kind}
                  onChange={(e) =>
                    setResources(
                      resources.map((v) =>
                        v.id === r.id
                          ? { ...v, kind: e.target.value as typeof r.kind }
                          : v,
                      ),
                    )
                  }
                >
                  <option value="LINK">Link</option>
                  <option value="FILE">File</option>
                  <option value="SLIDES">Slides</option>
                </NativeSelect>
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setResources(resources.filter((v) => v.id !== r.id))
                }
              >
                Remove resource {i + 1}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={resources.length >= 30}
            onClick={() =>
              setResources([
                ...resources,
                { id: crypto.randomUUID(), label: "", url: "", kind: "LINK" },
              ])
            }
          >
            Add resource
          </Button>
        </section>
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={async () => { try { await draftSave.flush(); onCancel() } catch { /* Inline recovery keeps the draft open. */ } }}>Cancel</Button><Button type="submit">{busy ? "Saving…" : meeting ? "Save changes" : "Create meeting"}</Button></div>
      </fieldset>
      <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-destructive" : "text-sm"}>{message}</p>
    </form>
  );
}
export function MeetingDetail({ id, onUpdated }: { id: string; onUpdated?: () => void }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const { user } = useAuth();
  useEffect(() => {
    let current = true;
    setMeeting(null);
    setError("");
    getMeeting(id)
      .then((value) => {
        if (current) setMeeting(value);
      })
      .catch((e) => {
        if (current)
          setError(e instanceof Error ? e.message : "Meeting unavailable.");
      });
    return () => {
      current = false;
    };
  }, [id, refresh]);
  if (error)
    return (
      <div role="alert">
        {error}{" "}
        <Button variant="outline" onClick={() => setRefresh((v) => v + 1)}>
          Retry
        </Button>
      </div>
    );
  if (!meeting) return <LoadingState label="Loading meeting…" layout="form" rows={3} />;
  const member = user?.memberships.find((m) => m.clubId === meeting.clubId),
    resources = resourceSchema.array().safeParse(meeting.resources);
  return (
    <article data-workspace-detail className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-4 border-b pb-7">
        <p className="text-sm text-muted-foreground">
          {meeting.club.name} ·{" "}
          {meeting.audience === "MEMBERS"
            ? "Member meeting"
            : "Recruitment / Interest"}
        </p>
        <h1 className="oc-page-title break-words">{meeting.title}</h1>
        <p>
          {meetingDate(meeting.date)}
          {meeting.endDate &&
            ` — ${meetingDate(meeting.endDate)}`}{" "}
          · {meeting.location}
        </p>
        <p className="whitespace-pre-wrap">{meeting.description}</p>
      </header>
      {hasPermission(member, "meetings.manage") && <MeetingGroupInvitation meeting={meeting} />}
      {(["agenda", "recap"] as const).map((key) => (
        <section key={key} className="space-y-3 border-t pt-5">
          <h2 className="oc-section-heading capitalize">{key}</h2>
          <p className="whitespace-pre-wrap text-sm leading-7">
            {meeting[key] || `No ${key} has been added yet.`}
          </p>
        </section>
      ))}
      <section className="space-y-3 border-t pt-5">
        <h2 className="oc-section-heading ">Resources</h2>
        {resources.success && resources.data.length ? (
          resources.data.map((r) => (
            <a
              key={r.id}
              className="block min-h-11 break-words rounded-md border bg-card p-4 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              href={r.url}
              target="_blank"
              rel="noreferrer"
            >
              {r.label} · {r.kind.toLowerCase()}<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No resources added yet.
          </p>
        )}
      </section>
      {hasPermission(member, "meetings.attendance") && (
        <MeetingAttendance meeting={meeting} />
      )}
      {hasPermission(member, "meetings.manage") && (
        <ActionWorkflow showCloseAction={false} title="Edit meeting" description="Update the meeting details, agenda, recap, or shared resources." trigger="Edit meeting">{done => <MeetingEditor key={meeting.revision} clubId={meeting.clubId} meeting={meeting} onCancel={done} onSaved={() => { done(); setRefresh(v => v + 1); onUpdated?.() }} />}</ActionWorkflow>
      )}
    </article>
  );
}
function MeetingAttendance({ meeting }: { meeting: Meeting }) {
  const demo = useDemoMode();
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [open, setOpen] = useState(false),
    [code, setCode] = useState<{ token: string; expiresAt: string } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [rows, setRows] = useState<Awaited<ReturnType<typeof meetingAttendance>>>(
      [],
    ),
    [now, setNow] = useState(Date.now()),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setRows([]);
    setAttendanceLoading(true);
    setError("");
    meetingAttendance(meeting.clubId, meeting.id)
      .then((value) => {
        if (current) setRows(value);
      })
      .catch(() => {
        if (current) setError("Could not load attendance.");
      }).finally(() => { if (current) setAttendanceLoading(false) });
    return () => {
      current = false;
    };
  }, [meeting.clubId, meeting.id, refresh]);
  useEffect(() => {
    if (!open) return;
    let current = true;
    const issue = async () => {
      try {
        const value = await issueMeetingCheckIn(meeting.clubId, meeting.id);
        if (current) {
          setCode(value);
          setError("");
        }
      } catch (e) {
        if (current)
          setError(
            e instanceof Error ? e.message : "Could not refresh QR code.",
          );
      }
    };
    void issue();
    const timer = setInterval(() => void issue(), 60000),
      clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      current = false;
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [open, meeting.clubId, meeting.id]);
  const valid = code && new Date(code.expiresAt).getTime() > now;
  return (
    <section className="space-y-4 border-t pt-5">
      <h2 className="oc-section-heading ">Attendance</h2>
      {demo.isDemoEnabled && (
        <p className="text-sm text-muted-foreground">
          Demo QR check-in works in this browser only. It does not simulate a
          shared cross-device database.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Codes refresh every minute and expire after 90 seconds. Attendees must
        sign in. Closing revokes all current codes; leaving this page lets them
        expire.
      </p>
      <Button
        variant="outline"
        onClick={async () => {
          if (open) {
            setOpen(false);
            setCode(null);
            try {
              await closeMeetingCheckIn(meeting.clubId, meeting.id);
            } catch {
              setError(
                "Could not close check-in. Existing codes will expire within 90 seconds.",
              );
            }
          } else {
            setNow(Date.now());
            setOpen(true);
          }
        }}
      >
        {open ? "Close check-in" : "Open attendance QR"}
      </Button>
      {open && valid && (
        <div className="space-y-3">
          <QRCodeSVG
            value={`${window.location.origin}/check-in?meetingId=${meeting.id}#token=${code.token}`}
            size={208}
            marginSize={4}
            title={`Check in to ${meeting.title}`}
          />
          <p role="status" className="text-sm">
            Current code expires in{" "}
            {Math.max(
              0,
              Math.ceil((new Date(code.expiresAt).getTime() - now) / 1000),
            )}{" "}
            seconds.
          </p>
        </div>
      )}
      {open && !valid && <p role="status">Waiting for a current code…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="flex items-center gap-4">
        <h3 className="oc-card-heading ">Attendance history{!attendanceLoading && !error ? ` · ${rows.length}` : ""}</h3>
        <Button variant="ghost" onClick={() => setRefresh((v) => v + 1)}>
          Refresh
        </Button>
      </div>
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="py-3 text-sm">
            <p className="font-medium">{row.name}</p>
            {row.email && <p>{row.email}</p>}
            <p className="text-muted-foreground">
              {new Date(row.checkedInAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
      {attendanceLoading && <LoadingState label="Loading attendance…" layout="inline" />}
      {!attendanceLoading && !error && !rows.length && (
        <p className="text-sm text-muted-foreground">No check-ins yet.</p>
      )}
    </section>
  );
}
