"use client";
import { useEditorDraft } from "@/hooks/use-editor-draft";
import { AutosaveStatus } from "@/components/ui/autosave-status";

import { useEffect, useRef, useState } from "react";
import { listClubCampusEvents, saveCampusEvent, commandCampusEvent, uploadEventFlyer, getCampusEventRsvpDashboard } from "@/lib/workspace-api";
import { eventDay, nyDate, eventSchedule, eventDurations, eventScheduleLabel, eventCategories, flyerTemplates, newYorkInput, newYorkInstant, eventDateLabel, managedEventStatus, eventRsvpSummary, type CampusEvent, type ManagedCampusEvent } from "@/lib/campus-events";
import { EventScheduleFields } from "./event-schedule-fields";
import { EventFlyer } from "./event-flyer";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "./events.css";
const tabs = ["Upcoming", "Past", "Pending Approval", "Rejected", "Drafts", "Closed"];
export function ClubEvents({ clubId, clubName, canSeeAttendees }: { clubId: string; clubName: string; canSeeAttendees: boolean }) {
  const [rows, setRows] = useState<ManagedCampusEvent[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""),
    [tab, setTab] = useState("Upcoming"), [editing, setEditing] = useState<ManagedCampusEvent | null | undefined>(),
    [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0),
    [confirm, setConfirm] = useState<ManagedCampusEvent | null>(null), [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const removeOrigin = useRef<HTMLButtonElement | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const overviewHeading = useRef<HTMLHeadingElement | null>(null);
  const removed = useRef(false);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    listClubCampusEvents(clubId).then(r => { if (active) setRows(r) }).catch(() => { if (active) { setRows([]); setError("Could not load events. Refresh to try again.") } }).finally(() => { if (active) setLoading(false) });
    return () => { active = false };
  }, [clubId, retry]);
  useEffect(() => { const refresh = () => setRetry(n => n + 1); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh) }, []);
  async function command(event: ManagedCampusEvent, value: "SUBMIT" | "WITHDRAW") {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError("");
    try {
      await commandCampusEvent({ eventId: event.id, clubId, revision: event.revision, command: value });
      setNotice(value === "WITHDRAW" ? `Removed “${event.title}” from Corkboard. Event history and RSVPs are preserved.` : "");
      removed.current = value === "WITHDRAW";
      if (value === "SUBMIT") setTab("Pending Approval");
      setConfirm(null); setRetry(n => n + 1);
    } catch { setError("Event could not be updated. Refresh and try again; it may have changed.") }
    finally { inFlight.current = false; setBusy(false) }
  }
  const event = rows.find(e => e.id === selected);
  const visible = rows.filter(e => tab === "Upcoming" ? +new Date(e.endDate) > Date.now() && !["ARCHIVED", "CANCELLED"].includes(e.status) : tab === "Past" ? +new Date(e.endDate) <= Date.now() : tab === "Pending Approval" ? e.status === "PENDING" : tab === "Rejected" ? e.status === "REJECTED" : tab === "Closed" ? ["CANCELLED", "ARCHIVED"].includes(e.status) : e.status === "DRAFT");
  if (editing !== undefined) return <EventEditor key={editing?.id || "new"} clubId={clubId} clubName={clubName} event={editing} onClose={() => { setEditing(undefined); setRetry(n => n + 1) }} onSaved={(next = "Drafts") => { setEditing(undefined); setTab(next); setRetry(n => n + 1) }} />;
  function actions(e: ManagedCampusEvent) {
    return <div className="oc-event-actions">
      {selected !== e.id && <Button variant="outline" onClick={() => setSelected(e.id)}>Manage event</Button>}
      {!["CANCELLED", "ARCHIVED"].includes(e.status) && <Button variant="outline" disabled={busy} onClick={() => setEditing(e)}>Edit & preview</Button>}
      {["DRAFT", "REJECTED"].includes(e.status) && <Button disabled={busy || +new Date(e.date) <= Date.now()} onClick={() => void command(e, "SUBMIT")}>Submit for approval</Button>}
      {["PUBLISHED", "PENDING"].includes(e.status) && <Button variant="outline" disabled={busy} onClick={click => { removeOrigin.current = click.currentTarget; removed.current = false; setConfirm(e); }}>Remove from Corkboard</Button>}
    </div>;
  }
  return <section aria-label="Corkboard Events" className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 ref={overviewHeading} tabIndex={-1} className="oc-section-heading">Corkboard Events</h2><p className="mt-2 text-sm text-muted-foreground">Public events, approval, and RSVP intent. Check-in attendance stays in Member Meetings.</p></div><Button onClick={() => { setSelected(null); setEditing(null) }}>+ Create Corkboard Event</Button></header>
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button variant="outline" size="sm" disabled={loading || busy} onClick={() => setRetry(n => n + 1)}>Refresh events</Button>
    {event ? <div className="oc-event-management-detail">
      <div><Button variant="ghost" onClick={() => setSelected(null)}>← All Corkboard events</Button><EventFlyer event={event} /></div>
      <div className="min-w-0 space-y-4"><h2 ref={detailHeading} tabIndex={-1} className="oc-section-heading break-words">{event.title}</h2><span className="oc-event-status">{managedEventStatus(event)}</span><p>{eventScheduleLabel(event)}</p><p className="break-words">{event.location}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{event.description}</p>
        {event.status === "PENDING" && <p role="status">Waiting for OutClass approval.</p>}
        {event.rejectionReason && <p className="rounded-lg border p-3 text-sm">Review feedback: {event.rejectionReason}</p>}
        <dl className="text-sm text-muted-foreground">{event.submittedAt && <><dt>Last submitted</dt><dd>{eventDateLabel(event.submittedAt)}</dd></>}{event.reviewedAt && <><dt>Last reviewed</dt><dd>{eventDateLabel(event.reviewedAt)}</dd></>}</dl>
        {actions(event)}
        {canSeeAttendees ? <RsvpDashboard key={event.id} event={event} /> : <p className="text-sm">{eventRsvpSummary(event.rsvpCount, event.capacity)}. Attendee access requires attendance-management permission.</p>}
      </div>
    </div> : <>
      <div className="oc-event-management-tabs" role="group" aria-label="Event filter">{tabs.map(t => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}{t === "Pending Approval" ? ` (${rows.filter(e => e.status === "PENDING").length})` : ""}</button>)}</div>
      {loading ? <LoadingState label="Loading club events…" layout="cards" rows={3} /> : !rows.length ? <div className="rounded-lg border p-8"><h3>No Corkboard events yet.</h3><p className="mt-2 text-sm text-muted-foreground">Create a draft, preview it, then submit it for OutClass approval.</p><Button className="mt-4" onClick={() => setEditing(null)}>Create Corkboard Event</Button></div> : !visible.length ? <p className="rounded-lg border p-8 text-sm">No events in {tab.toLowerCase()}.</p> : <ul className="oc-managed-events">{visible.map(e => <li className="oc-managed-event" key={e.id}>
        <div aria-hidden="true"><EventFlyer event={e} /></div><div className="min-w-0"><h3 className="break-words font-semibold">{e.title}</h3><p className="mt-2 text-sm">{eventScheduleLabel(e)}</p><p className="break-words text-sm text-muted-foreground">{e.location}</p><span className="oc-event-status">{managedEventStatus(e)} · {+new Date(e.endDate) <= Date.now() ? "Past" : "Upcoming"}</span><p className="mt-2 text-sm">{eventRsvpSummary(e.rsvpCount, e.capacity)}</p>{e.status === "PENDING" && <p className="mt-2 text-xs">Waiting for OutClass approval.</p>}{e.rejectionReason && <p className="mt-2 break-words text-sm">Review feedback: {e.rejectionReason}</p>}</div>{actions(e)}
      </li>)}</ul>}
    </>}
    <Dialog open={!!confirm} onOpenChange={open => { if (!open && !busy) setConfirm(null) }}><DialogContent onCloseAutoFocus={e => { e.preventDefault(); const target = removed.current ? detailHeading.current || overviewHeading.current : removeOrigin.current; if (target?.isConnected) target.focus(); }}><DialogTitle>Remove from Corkboard?</DialogTitle><DialogDescription>{confirm?.title} will leave the public Corkboard. Its event history and RSVP records will remain. Publishing again requires approval.</DialogDescription>{error && <p role="alert">{error}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>Keep event</Button><Button disabled={busy} onClick={() => confirm && void command(confirm, "WITHDRAW")}>Remove from Corkboard</Button></div></DialogContent></Dialog>
  </section>;
}
function RsvpDashboard({ event }: { event: ManagedCampusEvent }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCampusEventRsvpDashboard>> | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false), [open, setOpen] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => { if (!open) return; let active = true; setLoading(true); setError(""); getCampusEventRsvpDashboard(event.clubId, event.id).then(value => { if (active) setData(value) }).catch(() => { if (active) { setData(null); setError("RSVPs could not be loaded. Refresh to try again.") } }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [open, event.clubId, event.id, revision]);
  useEffect(() => { const refresh = () => setRevision(n => n + 1); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh) }, []);
  return <section className="min-w-0 space-y-3 rounded-lg border p-4" aria-label="Event RSVPs"><h3 className="font-semibold">RSVPs</h3><p role="status">{eventRsvpSummary(data?.count ?? event.rsvpCount, data ? data.capacity : event.capacity)}</p><p className="text-xs text-muted-foreground">RSVP intent is separate from recorded check-in attendance. Refreshes when you return to this window.</p><Button variant="outline" disabled={loading} onClick={() => { setOpen(true); setRevision(n => n + 1) }}>{loading ? "Loading RSVPs…" : open ? "Refresh RSVPs" : "View RSVPs"}</Button>{error && <p role="alert">{error}</p>}{open && data && (!data.attendees.length ? <p>No RSVPs yet.</p> : <ul className="divide-y">{data.attendees.map((a, i) => <li key={i} className="min-w-0 break-words py-3"><p className="font-medium">{a.name}</p><p className="text-sm">{a.email || "Identity withheld during anonymous review"}</p><p className="text-xs text-muted-foreground">RSVP · {eventDateLabel(a.createdAt)}</p></li>)}</ul>)}</section>;
}
function EventEditor({
  clubId,
  clubName,
  event,
  onClose,
  onSaved,
}: {
  clubId: string;
  clubName: string;
  event: ManagedCampusEvent | null;
  onClose: () => void;
  onSaved: (tab?: string) => void;
}) {
  const [saved, setSaved] = useState(event),
    [title, setTitle] = useState(event?.title || ""),
    [description, setDescription] = useState(event?.description || ""),
    [start, setStart] = useState(event ? newYorkInput(event.date) : ""),
    [end, setEnd] = useState(event ? newYorkInput(event.endDate) : ""),
    [allDay, setAllDay] = useState(event?.allDay ?? false),
    [lastDay, setLastDay] = useState(event?.allDay ? eventDay(nyDate(new Date(event.endDate)), -1) : ""),
    [duration, setDuration] = useState(event ? (eventDurations.some(m => m === (+new Date(event.endDate) - +new Date(event.date)) / 60000) ? String((+new Date(event.endDate) - +new Date(event.date)) / 60000) : "custom") : "60"),
    [uploading, setUploading] = useState(false),
    [location, setLocation] = useState(event?.location || ""),
    [category, setCategory] = useState(event?.category || "Social"),
    [contact, setContact] = useState(event?.contact || ""),
    [enabled, setEnabled] = useState(event?.rsvpEnabled ?? true),
    [required, setRequired] = useState(event?.rsvpRequired ?? false),
    [capacity, setCapacity] = useState(event?.capacity?.toString() || ""),
    [deadline, setDeadline] = useState(
      event?.rsvpDeadline ? newYorkInput(event.rsvpDeadline) : "",
    ),
    [template, setTemplate] = useState(event?.template || "academic"),
    [useTemplate, setUseTemplate] = useState(!event?.flyerUrl),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const draftSave = useEditorDraft({
    scope: { kind: "event", clubId, resourceId: event?.id ?? "new" },
    value: { title, description, start, end, allDay, lastDay, duration, location, category, contact, enabled, required, capacity, deadline, template, useTemplate },
    restore: d => { setTitle(d.title); setDescription(d.description); setStart(d.start); setEnd(d.end); setAllDay(d.allDay ?? false); setLastDay(d.lastDay ?? ""); setDuration(d.duration ?? "custom"); setLocation(d.location); setCategory(d.category); setContact(d.contact); setEnabled(d.enabled); setRequired(d.required); setCapacity(d.capacity); setDeadline(d.deadline); setTemplate(d.template); setUseTemplate(d.useTemplate) },
    base: event ? String(event.revision) : "new",
  });
  const operation = useRef(false);
  let date = new Date().toISOString(),
    endDate = new Date(Date.now() + 3600000).toISOString();
  try {
    const schedule = eventSchedule(start, end, duration, allDay, lastDay, event ?? undefined);
    date = schedule.date.toISOString(); endDate = schedule.endDate.toISOString();
  } catch {}
  const preview: CampusEvent = {
    id: saved?.id || "",
    clubId,
    clubName,
    title: title || "Your event name",
    description: description || "Tell students what to expect.",
    date,
    endDate,
    allDay,
    location: location || "Event location",
    category,
    contact,
    rsvpEnabled: enabled,
    rsvpRequired: required,
    capacity: capacity ? Number(capacity) : null,
    rsvpDeadline: null,
    template,
    flyerUrl: useTemplate ? null : saved?.flyerUrl || null,
    rsvpCount: saved?.rsvpCount || 0,
    revision: saved?.revision || 0,
  };
  async function save(finish: boolean, nested = false) {
    if (!nested && operation.current) return null;
    operation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await draftSave.flush();
      const result = await saveCampusEvent({
        ...(saved ? { id: saved.id } : {}),
        clubId,
        revision: saved?.revision || 0,
        title,
        description,
        ...eventSchedule(start, end, duration, allDay, lastDay, event ?? undefined),
        allDay,
        location,
        category,
        contact,
        rsvpEnabled: enabled,
        rsvpRequired: required,
        capacity: capacity ? Number(capacity) : null,
        rsvpDeadline: deadline ? newYorkInstant(deadline) : null,
        template,
        useTemplate,
      });
      setSaved(result);
      if (finish) { await draftSave.clear(); onSaved(); }
      else setNotice("Draft saved. You can now upload a flyer.");
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the event.");
      return null;
    } finally {
      if (!nested) { operation.current = false; setBusy(false); }
    }
  }
  async function submit() {
    if (operation.current) return;
    const current = await save(false, true);
    if (!current) { operation.current = false; setBusy(false); return; }
    setBusy(true);
    try { await commandCampusEvent({ clubId, eventId: current.id, revision: current.revision, command: "SUBMIT" }); await draftSave.clear(); onSaved("Pending Approval") }
    catch { setError("Draft saved, but submission failed. Refresh and try again.") }
    finally { operation.current = false; setBusy(false) }
  }
  async function upload(file: File) {
    if (operation.current) return;
    if (!file.size || file.size > 10 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG or WebP up to 10 MB."); return; }
    const current = await save(false, true);
    if (!current) { operation.current = false; setBusy(false); return; }
    setBusy(true); setUploading(true); setNotice("");
    try {
      const data = new FormData();
      data.set("eventId", current.id);
      data.set("clubId", clubId);
      data.set("revision", String(current.revision));
      data.set("file", file);
      const result = await uploadEventFlyer(data);
      setSaved({
        ...current,
        revision: result.revision,
        flyerUrl: `/api/event-flyers?eventId=${current.id}&revision=${result.revision}&preview=1`,
      });
      setUseTemplate(false);
      setNotice("Flyer uploaded privately. Apply event changes when ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Flyer upload failed.");
    } finally {
      operation.current = false; setBusy(false); setUploading(false);
    }
  }
  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-serif text-2xl">
          {event ? "Edit event" : "Create Corkboard Event"}
        </h2>
        <Button variant="ghost" disabled={busy} onClick={() => void draftSave.flush().then(onClose).catch(() => {})}>
          Back to events
        </Button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Your private draft saves automatically. Submit when ready for approval.
      </p>
      {event?.status === "PUBLISHED" && <p role="note" className="mb-5 rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-slate-900">Changing these event details or the flyer will remove the event from the public Corkboard until the changes are approved.</p>}
      <AutosaveStatus save={draftSave} />
      <form data-autosave-editor="true" onBlur={draftSave.onBlur} data-unsaved={draftSave.dirty}
        className="oc-event-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <fieldset disabled={busy || !draftSave.ready || draftSave.recovery != null} className="oc-event-editor-fields min-w-0">
          <label>
            Event name
            <Input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <EventScheduleFields start={start} end={end} duration={duration} allDay={allDay} lastDay={lastDay} existing={event ?? undefined} setStart={setStart} setEnd={setEnd} setDuration={setDuration} setAllDay={setAllDay} setLastDay={setLastDay} />
          <label>
            Location
            <Input
              required
              maxLength={500}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              aria-describedby="event-description-help"
              required
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <p id="event-description-help" className="text-xs leading-relaxed text-muted-foreground">Include all important flyer information here, including access details and any instructions shown only in the image. Students can read this description in the event details without viewing the flyer.</p>
          <div className="oc-event-editor-pair">
            <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {eventCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Contact information
              <Input
                maxLength={500}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </label>
          </div>
          <label className="oc-event-check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                if (!e.target.checked) setRequired(false);
              }}
            />
            Enable RSVP
          </label>
          <label className="oc-event-check">
            <input
              type="checkbox"
              disabled={!enabled}
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            RSVP required
          </label>
          <div className="oc-event-editor-pair">
            <label>
              Capacity (optional)
              <Input
                type="number"
                min={1}
                max={100000}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </label>
            <label>
              RSVP deadline
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          </div>
          <label>
            Flyer treatment
            <select
              value={useTemplate ? template : "upload"}
              onChange={(e) => {
                setUseTemplate(e.target.value !== "upload");
                if (e.target.value !== "upload") setTemplate(e.target.value);
              }}
            >
              {flyerTemplates.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)} template
                </option>
              ))}
              {saved?.flyerUrl && (
                <option value="upload">Uploaded flyer</option>
              )}
            </select>
          </label>
          {!useTemplate && saved?.flyerUrl && <Button type="button" variant="outline" disabled={busy} onClick={() => { setUseTemplate(true); setNotice("Flyer removed from this preview. Save the draft to apply."); }}>Remove uploaded flyer</Button>}
          <label className="rounded-xl border-2 border-dashed p-5" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !busy && draftSave.ready && !draftSave.recovery) void upload(file); }}>
            Event Flyer — Optional
            <span className="block text-sm text-muted-foreground">Drop a PNG, JPEG or WebP here, or choose a file. Up to 10 MB.</span>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </label>
          {uploading && <div role="status" aria-live="polite"><progress aria-label="Uploading flyer" /> Uploading flyer…</div>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => document.getElementById("event-flyer-preview")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Preview</Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>Submit for Approval</Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Applying…" : "Apply event changes"}
          </Button></div>
        </fieldset>
        <aside className="oc-event-editor-preview" id="event-flyer-preview" aria-label="Flyer preview">
          <EventFlyer event={preview} />
          <p className="mt-3 text-xs text-muted-foreground">
            Preview · Structured details above are authoritative.
          </p>
        </aside>
      </form>
    </section>
  );
}
