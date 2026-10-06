"use client";
import { useEffect, useState } from "react";
import {
  listClubCampusEvents,
  saveCampusEvent,
  commandCampusEvent,
  uploadEventFlyer,
  getCampusEventAttendees,
} from "@/lib/workspace-api";
import {
  eventCategories,
  flyerTemplates,
  newYorkInput,
  newYorkInstant,
  eventDateLabel,
  type CampusEvent,
  type ManagedCampusEvent,
} from "@/lib/campus-events";
import { EventFlyer } from "./event-flyer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "./events.css";
const tabs = [
  "Upcoming",
  "Past",
  "Pending Approval",
  "Rejected",
  "Cancelled",
  "Drafts",
];
export function ClubEvents({
  clubId,
  clubName,
  canSeeAttendees,
}: {
  clubId: string;
  clubName: string;
  canSeeAttendees: boolean;
}) {
  const [rows, setRows] = useState<ManagedCampusEvent[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Upcoming"),
    [editing, setEditing] = useState<ManagedCampusEvent | null | undefined>(),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [attendees, setAttendees] = useState<
      { name: string; email: string | null; createdAt: string }[] | null
    >(null),
    [attendeeTitle, setAttendeeTitle] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    listClubCampusEvents(clubId)
      .then((r) => {
        if (active) {
          setRows(r);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Could not load events.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clubId, retry]);
  async function command(
    event: ManagedCampusEvent,
    command: "SUBMIT" | "WITHDRAW" | "CANCEL" | "ARCHIVE",
  ) {
    setBusy(true);
    setError("");
    try {
      await commandCampusEvent({
        eventId: event.id,
        clubId,
        revision: event.revision,
        command,
      });
      setRetry((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Event could not be updated.");
    } finally {
      setBusy(false);
    }
  }
  async function showAttendees(event: ManagedCampusEvent) {
    setBusy(true);
    setError("");
    try {
      setAttendees(await getCampusEventAttendees(clubId, event.id));
      setAttendeeTitle(event.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Attendees unavailable.");
    } finally {
      setBusy(false);
    }
  }
  const visible = rows.filter((e) =>
    tab === "Upcoming"
      ? e.status === "PUBLISHED" && +new Date(e.endDate) > Date.now()
      : tab === "Past"
        ? (e.status === "PUBLISHED" && +new Date(e.endDate) <= Date.now()) ||
          e.status === "ARCHIVED"
        : tab === "Pending Approval"
          ? e.status === "PENDING"
          : tab === "Rejected"
            ? e.status === "REJECTED"
            : tab === "Cancelled"
              ? e.status === "CANCELLED"
              : e.status === "DRAFT",
  );
  if (editing !== undefined)
    return (
      <EventEditor
        key={editing?.id || "new"}
        clubId={clubId}
        clubName={clubName}
        event={editing}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          setTab("Drafts");
          setRetry((n) => n + 1);
        }}
      />
    );
  return (
    <section aria-label="Club events">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Create a campus event, then submit it for admin approval.
        </p>
        <Button onClick={() => setEditing(null)}>Create event</Button>
      </div>
      <div className="oc-event-management-tabs" aria-label="Event status">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Pending Approval"
              ? ` (${rows.filter((e) => e.status === "PENDING").length})`
              : ""}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="mb-4 text-sm text-destructive">
          {error}{" "}
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            Reload events
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading events…</p>
      ) : (
        <div className="oc-managed-events">
          {visible.length ? (
            visible.map((e) => (
              <article className="oc-managed-event" key={e.id}>
                <div aria-hidden="true">
                  <EventFlyer event={e} />
                </div>
                <div>
                  <h2 className="font-semibold">{e.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {eventDateLabel(e.date)} · {e.rsvpCount} RSVPs
                    {e.capacity !== null ? ` / ${e.capacity} capacity` : ""}
                  </p>
                  <span className="oc-event-status">
                    {e.status === "PUBLISHED"
                      ? "Approved · Published"
                      : e.status === "PENDING"
                        ? "Pending admin approval"
                        : e.status.toLowerCase()}
                  </span>
                  {e.rejectionReason && (
                    <p className="mt-2 text-sm">Reason: {e.rejectionReason}</p>
                  )}
                </div>
                <div className="oc-event-actions">
                  {!["CANCELLED", "ARCHIVED"].includes(e.status) && (
                    <>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setEditing(e)}
                      >
                        Edit & preview
                      </Button>
                      {["DRAFT", "REJECTED"].includes(e.status) ? (
                        <Button
                          disabled={busy}
                          onClick={() => void command(e, "SUBMIT")}
                        >
                          Submit for approval
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => void command(e, "WITHDRAW")}
                        >
                          Withdraw
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void command(e, "CANCEL")}
                      >
                        Cancel event
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void command(e, "ARCHIVE")}
                      >
                        Archive
                      </Button>
                    </>
                  )}
                  {canSeeAttendees && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void showAttendees(e)}
                    >
                      RSVP attendees
                    </Button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-lg border p-8 text-sm text-muted-foreground">
              No events in {tab.toLowerCase()}.
            </p>
          )}
        </div>
      )}
      <Dialog
        open={attendees !== null}
        onOpenChange={(open) => {
          if (!open) setAttendees(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-auto">
          <DialogTitle>RSVP attendees</DialogTitle>
          <DialogDescription>
            {attendeeTitle} · RSVP intent, separate from check-in attendance.
          </DialogDescription>
          {attendees?.length ? (
            <table className="oc-attendee-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>RSVP date</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a, i) => (
                  <tr key={i}>
                    <td>{a.name}</td>
                    <td>{a.email || "Withheld during anonymous review"}</td>
                    <td>{eventDateLabel(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No RSVPs yet.</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
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
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState(event),
    [title, setTitle] = useState(event?.title || ""),
    [description, setDescription] = useState(event?.description || ""),
    [start, setStart] = useState(event ? newYorkInput(event.date) : ""),
    [end, setEnd] = useState(event ? newYorkInput(event.endDate) : ""),
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
  let date = "2026-10-16T23:00:00Z",
    endDate = "2026-10-17T01:00:00Z";
  try {
    if (start) date = newYorkInstant(start).toISOString();
    if (end) endDate = newYorkInstant(end).toISOString();
  } catch {}
  const preview: CampusEvent = {
    id: saved?.id || "",
    clubId,
    clubName,
    title: title || "Your event name",
    description: description || "Tell students what to expect.",
    date,
    endDate,
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
  async function save(finish: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await saveCampusEvent({
        ...(saved ? { id: saved.id } : {}),
        clubId,
        revision: saved?.revision || 0,
        title,
        description,
        date: newYorkInstant(start),
        endDate: newYorkInstant(end),
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
      if (finish) onSaved();
      else setNotice("Draft saved. You can now upload a flyer.");
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the event.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    const current = await save(false);
    if (!current) return;
    setBusy(true);
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
      setNotice("Flyer uploaded privately. Save your draft to finish.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Flyer upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-serif text-2xl">
          {event ? "Edit event" : "Create event"}
        </h2>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Back to events
        </Button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Save a draft, preview your flyer, then submit it from Drafts. Editing an
        approved event withdraws it until an administrator approves the new
        revision.
      </p>
      <form
        className="oc-event-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <div className="oc-event-editor-fields">
          <label>
            Event name
            <Input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              required
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="oc-event-editor-pair">
            <label>
              Starts (Eastern Time)
              <Input
                required
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Ends (Eastern Time)
              <Input
                required
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            During the fall clock change, ambiguous times use the earlier
            occurrence. Spring clock-change gaps are rejected.
          </p>
          <label>
            Location
            <Input
              required
              maxLength={500}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
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
              RSVP deadline (Eastern Time)
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
          <label>
            Upload a flyer (PNG, JPEG or WebP · up to 5 MB)
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
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save draft"}
          </Button>
        </div>
        <aside className="oc-event-editor-preview" aria-label="Flyer preview">
          <EventFlyer event={preview} />
          <p className="mt-3 text-xs text-muted-foreground">
            Preview · Structured details above are authoritative.
          </p>
        </aside>
      </form>
    </section>
  );
}
