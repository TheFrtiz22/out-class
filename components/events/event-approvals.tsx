"use client";
import { useEffect, useState, useRef } from "react";
import { listEventApprovals, reviewCampusEvent } from "@/actions/campus-events";
import {
  type ManagedCampusEvent,
  eventDateLabel,
  eventTimeLabel,
} from "@/lib/campus-events";
import { EventFlyer } from "./event-flyer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "./events.css";
export function EventApprovals() {
  const origin = useRef<HTMLButtonElement | null>(null),
    queueTab = useRef<HTMLButtonElement | null>(null),
    decided = useRef(false);
  const [status, setStatus] = useState("PENDING"),
    [events, setEvents] = useState<ManagedCampusEvent[]>([]),
    [count, setCount] = useState(0),
    [selected, setSelected] = useState<ManagedCampusEvent | null>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listEventApprovals(status)
      .then((r) => {
        if (active) {
          setEvents(r.events);
          setCount(r.pendingCount);
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Could not load approvals.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, retry]);
  async function decide(approved: boolean) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await reviewCampusEvent({
        eventId: selected.id,
        revision: selected.revision,
        approved,
        reason,
      });
      decided.current = true;
      setSelected(null);
      setReason("");
      setRetry((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Event approvals">
      <div className="oc-event-management-tabs">
        {[
          ["PENDING", `Pending (${count})`],
          ["PUBLISHED", "Approved"],
          ["REJECTED", "Rejected"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            ref={id === status ? queueTab : undefined}
            aria-pressed={status === id}
            onClick={() => setStatus(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && !selected && (
        <p role="alert">
          {error}{" "}
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </Button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading submissions…</p>
      ) : (
        <div className="oc-managed-events">
          {events.length ? (
            events.map((e) => (
              <article className="oc-managed-event" key={e.id}>
                <div aria-hidden="true">
                  <EventFlyer event={e} />
                </div>
                <div>
                  <h2 className="font-semibold">{e.title}</h2>
                  <p className="text-sm">Hosted by {e.clubName}</p>
                  <p className="text-sm text-muted-foreground">
                    {eventDateLabel(e.date)} · {eventTimeLabel(e.date)} ·{" "}
                    {e.location}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted{" "}
                    {e.submittedAt
                      ? `${eventDateLabel(e.submittedAt)} · ${eventTimeLabel(e.submittedAt)}`
                      : "—"}
                  </p>
                </div>
                <div className="oc-event-actions">
                  <Button
                    variant="outline"
                    onClick={(click) => {
                      origin.current = click.currentTarget;
                      decided.current = false;
                      setSelected(e);
                      setReason("");
                      setError("");
                    }}
                  >
                    {status === "PENDING" ? "Review submission" : "View event"}
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-lg border p-8 text-sm text-muted-foreground">
              No {status.toLowerCase()} submissions.
            </p>
          )}
        </div>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        {selected && (
          <DialogContent
            className="oc-event-detail"
            onCloseAutoFocus={(event) => {
              const target = decided.current
                ? queueTab.current
                : origin.current;
              if (target?.isConnected) {
                event.preventDefault();
                target.focus();
              }
            }}
          >
            <div className="oc-pulled-flyer" aria-hidden="true">
              <EventFlyer event={selected} />
            </div>
            <div className="oc-event-detail-copy">
              <p className="oc-eyebrow">
                {selected.category} · {selected.status.toLowerCase()}
              </p>
              <DialogTitle className="oc-event-title">
                {selected.title}
              </DialogTitle>
              <DialogDescription>
                Hosted by {selected.clubName} · Revision {selected.revision}
              </DialogDescription>
              <dl className="oc-event-facts">
                <div>
                  <dt>Starts</dt>
                  <dd>
                    {eventDateLabel(selected.date)} ·{" "}
                    {eventTimeLabel(selected.date)}
                  </dd>
                </div>
                <div>
                  <dt>Ends</dt>
                  <dd>
                    {eventDateLabel(selected.endDate)} ·{" "}
                    {eventTimeLabel(selected.endDate)}
                  </dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{selected.location}</dd>
                </div>
                <div>
                  <dt>RSVP</dt>
                  <dd>
                    {selected.rsvpEnabled
                      ? selected.rsvpRequired
                        ? "Required"
                        : "Optional"
                      : "Disabled"}{" "}
                    ·{" "}
                    {selected.capacity === null
                      ? "Unlimited capacity"
                      : `${selected.capacity} capacity`}
                  </dd>
                </div>
                {selected.rsvpDeadline && (
                  <div>
                    <dt>RSVP deadline</dt>
                    <dd>
                      {eventDateLabel(selected.rsvpDeadline)} ·{" "}
                      {eventTimeLabel(selected.rsvpDeadline)}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="oc-event-description">{selected.description}</p>
              <p className="text-sm">
                Contact: {selected.contact || "Not specified"}
              </p>
              {selected.rejectionReason && (
                <p className="text-sm">
                  Rejection reason: {selected.rejectionReason}
                </p>
              )}
              {selected.status === "PENDING" && (
                <div className="space-y-3">
                  <label className="block text-sm">
                    Review note / rejection reason
                    <textarea
                      className="mt-2 w-full rounded border bg-background p-2"
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="A reason is required when rejecting."
                    />
                  </label>
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() => void decide(true)}
                  >
                    Approve & Publish
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={busy || reason.trim().length < 5}
                    onClick={() => void decide(false)}
                  >
                    Reject
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This decision is audited. Your own club’s submissions
                    require another administrator.
                  </p>
                </div>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
