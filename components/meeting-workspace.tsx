"use client";
import Link from "next/link";
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
import { resourceSchema } from "@/lib/meetings";
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
    [audience, setAudience] = useState(initialAudience),
    [refresh, setRefresh] = useState(0);
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
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Club meetings</h2>
        {!embedded && <Link className="text-sm underline" href="/meetings">
          All available meetings
        </Link>}
      </div>
      <p className="text-sm text-muted-foreground">
        Recruitment meetings and member meetings share one place for agendas,
        resources, and recaps—including meetings you missed.
      </p>
      {!personalOnly && clubId && hasPermission(member, "meetings.manage") && (
        <details className="border-y py-4">
          <summary className="cursor-pointer font-medium">
            Create a meeting
          </summary>
          <MeetingEditor
            clubId={clubId}
            onSaved={() => setRefresh((v) => v + 1)}
          />
        </details>
      )}
      <label>
        Audience{" "}
        <select
          className="ml-3 rounded border p-2"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        >
          <option value="ALL">All permitted meetings</option>
          <option value="RECRUITMENT">Recruitment / Interest</option>
          <option value="MEMBERS">Members</option>
        </select>
      </label>
      {loading && <p role="status">Loading meetings…</p>}
      {error && (
        <div role="alert">
          {error}{" "}
          <Button variant="outline" onClick={() => setRefresh((v) => v + 1)}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !error && !meetings.some(m => audience === "ALL" || m.audience === audience) && (
        <p className="py-6 text-sm text-muted-foreground">
          No meetings are available for this audience yet.
        </p>
      )}
      <ul className="divide-y">
        {meetings
          .filter((m) => audience === "ALL" || m.audience === audience)
          .map((m) => (
            <li className="py-4" key={m.id}>
              <a
                className="block space-y-1 rounded-sm focus-visible:outline focus-visible:outline-ring"
                href={`/meetings/${m.id}`}
              >
                <p className="text-xs text-muted-foreground">
                  {m.club.name} ·{" "}
                  {m.audience === "MEMBERS"
                    ? "Members"
                    : "Recruitment / Interest"}
                </p>
                <h3 className="font-semibold">{m.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(m.date).toLocaleString()} · {m.location}
                </p>
                {m.recap && <p className="text-xs">Recap available</p>}
              </a>
            </li>
          ))}
      </ul>
    </section>
  );
}
function MeetingEditor({
  clubId,
  meeting,
  onSaved,
}: {
  clubId: string;
  meeting?: Meeting;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const initial = resourceSchema.array().safeParse(meeting?.resources || []);
  const [resources, setResources] = useState(
    initial.success ? initial.data : [],
  );
  return (
    <form
      className="space-y-4 py-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          data = new FormData(form);
        setBusy(true);
        setMessage("");
        try {
          await saveMeeting({
            id: meeting?.id,
            clubId,
            title: data.get("title"),
            description: data.get("description"),
            date: new Date(String(data.get("date"))),
            endDate: data.get("endDate")
              ? new Date(String(data.get("endDate")))
              : null,
            location: data.get("location"),
            audience: data.get("audience"),
            agenda: data.get("agenda"),
            recap: data.get("recap"),
            resources,
            revision: meeting?.revision || 0,
          });
          setMessage("Meeting saved.");
          if (!meeting) {
            form.reset();
            setResources([]);
          }
          onSaved();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Could not save.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <label className="block">
          Title
          <Input
            name="title"
            required
            maxLength={200}
            defaultValue={meeting?.title}
          />
        </label>
        <label className="block">
          Audience
          <select
            name="audience"
            defaultValue={meeting?.audience || "RECRUITMENT"}
            className="ml-3 rounded border p-2"
          >
            <option value="RECRUITMENT">Recruitment / Interest</option>
            <option value="MEMBERS">Members</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Starts (your local time)
            <Input
              name="date"
              type="datetime-local"
              required
              defaultValue={localDate(
                meeting ? new Date(meeting.date) : new Date(),
              )}
            />
          </label>
          <label>
            Ends (optional)
            <Input
              name="endDate"
              type="datetime-local"
              defaultValue={
                meeting?.endDate ? localDate(new Date(meeting.endDate)) : ""
              }
            />
          </label>
        </div>
        <label className="block">
          Location
          <Input
            name="location"
            required
            maxLength={500}
            defaultValue={meeting?.location}
          />
        </label>
        {(["description", "agenda", "recap"] as const).map((key) => (
          <label className="block capitalize" key={key}>
            {key}
            <Textarea
              name={key}
              rows={4}
              maxLength={key === "description" ? 10000 : 20000}
              defaultValue={meeting?.[key] || ""}
            />
          </label>
        ))}
        <section className="space-y-3">
          <h3 className="font-medium">Slides, files, and links</h3>
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
                <select
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
                </select>
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
        <Button type="submit">{busy ? "Saving…" : "Save meeting"}</Button>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  );
}
export function MeetingDetail({ id }: { id: string }) {
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
  if (!meeting) return <p role="status">Loading meeting…</p>;
  const member = user?.memberships.find((m) => m.clubId === meeting.clubId),
    resources = resourceSchema.array().safeParse(meeting.resources);
  return (
    <article className="space-y-7">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {meeting.club.name} ·{" "}
          {meeting.audience === "MEMBERS"
            ? "Member meeting"
            : "Recruitment / Interest"}
        </p>
        <h1 className="font-display text-3xl">{meeting.title}</h1>
        <p>
          {new Date(meeting.date).toLocaleString()}
          {meeting.endDate &&
            ` – ${new Date(meeting.endDate).toLocaleTimeString()}`}{" "}
          · {meeting.location}
        </p>
        <p className="whitespace-pre-wrap">{meeting.description}</p>
      </header>
      {(["agenda", "recap"] as const).map((key) => (
        <section key={key} className="space-y-3 border-t pt-5">
          <h2 className="text-lg font-semibold capitalize">{key}</h2>
          <p className="whitespace-pre-wrap text-sm leading-7">
            {meeting[key] || `No ${key} has been added yet.`}
          </p>
        </section>
      ))}
      <section className="space-y-3 border-t pt-5">
        <h2 className="text-lg font-semibold">Resources</h2>
        {resources.success && resources.data.length ? (
          resources.data.map((r) => (
            <a
              key={r.id}
              className="block break-words text-sm underline"
              href={r.url}
              target="_blank"
              rel="noreferrer"
            >
              {r.label} · {r.kind.toLowerCase()}
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
        <details className="border-t pt-5">
          <summary className="cursor-pointer font-medium">Edit meeting</summary>
          <MeetingEditor
            key={meeting.revision}
            clubId={meeting.clubId}
            meeting={meeting}
            onSaved={() => setRefresh((v) => v + 1)}
          />
        </details>
      )}
    </article>
  );
}
function MeetingAttendance({ meeting }: { meeting: Meeting }) {
  const demo = useDemoMode();
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
    setError("");
    meetingAttendance(meeting.clubId, meeting.id)
      .then((value) => {
        if (current) setRows(value);
      })
      .catch(() => {
        if (current) setError("Could not load attendance.");
      });
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
      <h2 className="text-lg font-semibold">Attendance</h2>
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
        <h3 className="font-medium">Attendance history · {rows.length}</h3>
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
      {!rows.length && (
        <p className="text-sm text-muted-foreground">No check-ins yet.</p>
      )}
    </section>
  );
}
