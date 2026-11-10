"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/ui/loading-state";
import { Search, SlidersHorizontal, Check, ChevronDown } from "@/components/icons";
import { useDismissableDetails } from "@/hooks/use-dismissable-details";
import { useAuth } from "@/contexts/auth-context";
import {
  getPublicCorkboard,
  getPublicCampusEvent,
  getCampusEventRsvp,
  setCampusEventRsvp,
  getMyCampusEventRsvps,
} from "@/lib/workspace-api";
import {
  eventCategories,
  eventDateLabel,
  eventTimeLabel,
  eventScheduleLabel,
  type CampusEvent,
  type EventFilters,
} from "@/lib/campus-events";
import { EventFlyer } from "./event-flyer";
import { SegmentedControl } from "@/components/product/segmented-control";
import { SmartEventCard } from "./smart-event-card";
import { EventCalendarButton, EventSaveButton } from "./event-discovery-actions";
import { useSavedCampusEvents } from "./use-saved-campus-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "./events.css";
import { eventBoardEmpty } from "@/lib/event-board-empty";
import { NativeSelect } from "@/components/ui/native-select"
const initialFilters: EventFilters = {
  query: "",
  period: "All",
  category: "",
  clubId: "",
  date: "",
  location: "",
  required: false,
  savedOnly: false,
  sort: "soonest",
  page: 0,
};
export function PublicEventBoard() {
  const { user } = useAuth(),
    identity = user?.id || "";
  const filterMenu = useDismissableDetails();
  const [filters, setFilters] = useState(initialFilters),
    [events, setEvents] = useState<CampusEvent[]>([]),
    [clubs, setClubs] = useState<{ id: string; name: string }[]>([]),
    [total, setTotal] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [selected, setSelected] = useState<CampusEvent | null>(null),
    [open, setOpen] = useState(false);
  const origin = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const eventId = useSearchParams().get("event");
  const [linkedLoading, setLinkedLoading] = useState(false),
    [linkedError, setLinkedError] = useState(""),
    [linkedMissing, setLinkedMissing] = useState(false),
    [linkedRetry, setLinkedRetry] = useState(0);
  const [view, setView] = useState<"corkboard" | "list">("corkboard");
  const saves = useSavedCampusEvents(identity);
  useEffect(() => {
    try {
      const preference = localStorage.getItem("outclass:events:view:v1");
      if (preference === "list" || preference === "corkboard") setView(preference);
      // Phones open on the list of event cards, as in the OutClass app, until the student picks a view.
      else if (window.matchMedia?.("(max-width: 1023px)").matches) setView("list");
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, []);
  useEffect(() => {
    // A personal filter must never carry into a different account's session.
    setFilters(f => f.savedOnly ? { ...f, savedOnly: false, page: 0 } : f);
  }, [identity]);
  function changeView(next: "corkboard" | "list") {
    setView(next);
    try { localStorage.setItem("outclass:events:view:v1", next); } catch { /* Switching still works. */ }
  }
  async function saveEvent(id: string) {
    if (await saves.toggle(id)) {
      if (filters.savedOnly) setFilters(f => ({ ...f, page: 0 }));
    }
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      getPublicCorkboard({ ...filters, savedOnly: !!identity && filters.savedOnly })
        .then((r) => {
          if (active) {
            setEvents(r.events);
            setClubs(r.clubs);
            setTotal(r.total);
            setHasMore(r.hasMore);
          }
        })
        .catch(() => {
          if (active) {
            setEvents([]);
            setError("We couldn’t load campus events. Please try again.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, retry, identity]);
  useEffect(() => {
    let active = true;
    setLinkedError("");
    setLinkedMissing(false);
    setOpen(false);
    setSelected(null);
    setLinkedLoading(!!eventId);
    if (!eventId) return;
    if (!z.string().uuid().safeParse(eventId).success) {
      setLinkedLoading(false);
      setLinkedMissing(true);
      return;
    }
    getPublicCampusEvent(eventId)
      .then((event) => {
        if (!active) return;
        if (event) {
          setSelected(event);
          setOpen(true);
        } else setLinkedMissing(true);
      })
      .catch(() => {
        if (active) setLinkedError("We couldn’t load this event. Please try again.");
      })
      .finally(() => { if (active) setLinkedLoading(false); });
    return () => { active = false; };
  }, [eventId, linkedRetry]);
  function filter(p: EventFilters) {
    setFilters((f) => ({ ...f, ...p, page: 0 }));
  }
  // Everything inside the Filter menu, so its button can show how many apply.
  const menuFilters = [filters.category, filters.clubId, filters.date, filters.location, filters.required, !!identity && filters.savedOnly].filter(Boolean).length;
  const narrowed = menuFilters > 0 || !!filters.query || filters.period !== "All";
  function updateEvent(eventId: string, count: number) {
    setEvents((rows) =>
      rows.map((e) => (e.id === eventId ? { ...e, rsvpCount: count } : e)),
    );
    setSelected((e) => (e?.id === eventId ? { ...e, rsvpCount: count } : e));
  }
  return (
    <section
      className="oc-event-board-section"
      aria-label="Public campus events"
    >
      {linkedLoading && <LoadingState label="Opening linked event…" layout="inline" />}
      {linkedError && <div role="alert" className="mb-4 space-y-2"><p>{linkedError}</p><Button variant="outline" onClick={() => setLinkedRetry(n => n + 1)}>Retry event</Button></div>}
      {linkedMissing && <p role="status" className="mb-4 text-sm text-muted-foreground">This event is no longer available. Browse the campus events below.</p>}
      <div className="oc-event-toolbar">
        <SegmentedControl
          label="Event date range"
          className="oc-event-periods"
          value={filters.period ?? "All"}
          onChange={(period) => filter({ period })}
          options={(["All", "Today", "This Week", "Weekend"] as const).map((period) => ({
            value: period,
            label: period === "All" ? "All Events" : period,
          }))}
        />
        <div className="oc-event-toolbar-actions">
        <label className="oc-event-search">
          <Search size={16} aria-hidden="true" />
          <Input
            aria-label="Search events"
            value={filters.query || ""}
            placeholder="Search events…"
            onChange={(e) => filter({ query: e.target.value })}
          />
        </label>
        <details ref={filterMenu} className="oc-event-filter">
          <summary>
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filter
            {menuFilters > 0 && <span className="oc-event-filter-count"><span aria-hidden="true">{menuFilters}</span><span className="sr-only">, {menuFilters} active</span></span>}
          </summary>
          <div className="oc-event-filter-fields">
            {identity && (
              <label className="oc-event-check">
                <input
                  type="checkbox"
                  checked={!!filters.savedOnly}
                  onChange={(e) => filter({ savedOnly: e.target.checked })}
                />
                Saved events
              </label>
            )}
            <label>
              Category
              <NativeSelect
                value={filters.category}
                onChange={(e) =>
                  filter({
                    category: e.target.value as EventFilters["category"],
                  })
                }
              >
                <option value="">All categories</option>
                {eventCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </label>
            <label>
              Club
              <NativeSelect
                value={filters.clubId}
                onChange={(e) => filter({ clubId: e.target.value })}
              >
                <option value="">All clubs</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label>
              Date (Eastern Time)
              <Input
                type="date"
                value={filters.date}
                onChange={(e) => filter({ date: e.target.value })}
              />
            </label>
            <label>
              Location
              <Input
                value={filters.location}
                onChange={(e) => filter({ location: e.target.value })}
              />
            </label>
            <label>
              Sort
              <NativeSelect
                value={filters.sort}
                onChange={(e) =>
                  filter({ sort: e.target.value as EventFilters["sort"] })
                }
              >
                <option value="soonest">Soonest first</option>
                <option value="latest">Latest first</option>
                <option value="name">Name A–Z</option>
              </NativeSelect>
            </label>
            <label className="oc-event-check">
              <input
                type="checkbox"
                checked={filters.required || false}
                onChange={(e) => filter({ required: e.target.checked })}
              />
              RSVP required
            </label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFilters(initialFilters)}
            >
              Reset filters
            </Button>
          </div>
        </details>
        <SegmentedControl label="Event view" value={view} onChange={changeView} animated className="oc-event-view-switch" options={[{ value: "corkboard", label: "Board" }, { value: "list", label: "List" }]} />
        </div>
      </div>
      {saves.error && <div role="alert" className="oc-event-save-error"><p>{saves.error}</p>{!saves.ready && <Button variant="outline" onClick={saves.retry}>Retry saved events</Button>}</div>}
      <p className="oc-event-result" role="status" aria-live="polite">
        {loading
          ? "Loading campus events…"
          : error ||
            `${total} approved ${total === 1 ? "event" : "events"} · Times shown in Eastern Time`}
      </p>
      {error ? (
        <div role="alert" className="oc-events-empty">
          <p>{error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>Retry events</Button>
        </div>
      ) : (
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
          }}
        >
          <div key={view} role="region" className={view === "corkboard" ? "oc-physical-board oc-event-view" : "oc-event-list oc-event-view"} data-empty={!events.length || undefined} aria-busy={loading} aria-label={view === "corkboard" ? "Corkboard events" : "Event list"}>
            {!loading && !events.length ? (
              (() => { const empty = eventBoardEmpty(filters); return <div className="oc-events-empty">
                <h2>{empty.title}</h2>
                <p>{empty.description}</p>
                {empty.action.kind === "explore-clubs"
                  ? <Button variant="outline" asChild><Link href="/explore">{empty.action.label}</Link></Button>
                  : <Button variant="outline" onClick={() => setFilters(empty.action.kind === "clear-filters" ? { ...initialFilters, savedOnly: filters.savedOnly, sort: filters.sort } : { ...filters, savedOnly: false, page: 0 })}>{empty.action.label}</Button>}
              </div> })()
            ) : view === "list" ? (
              <ul className="oc-smart-event-list">
                {events.map(event => <li key={event.id}><SmartEventCard event={event} save={{ identity, saved: saves.ids.has(event.id), ready: saves.ready, pending: saves.pending.has(event.id), onSave: () => void saveEvent(event.id) }} onOpen={(event, trigger) => { origin.current = trigger; setSelected(event); setOpen(true); }} /></li>)}
              </ul>
            ) : (
              <ul className="oc-flyer-grid">
                {events.map((event, index) => {
                  const rotation = [-3, 1, -1, 2, -2, 3][index % 6];
                  return (
                    <li
                      key={event.id}
                      style={
                        {
                          "--flyer-rotation": `${rotation}deg`,
                          "--pin-color": [
                            "var(--brand-orange)",
                            "var(--info)",
                            "var(--success)",
                            "var(--warning)",
                          ][index % 4],
                        } as CSSProperties
                      }
                    >
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="oc-pinned-flyer"
                          data-selected={open && selected?.id === event.id}
                          onClick={(e) => {
                            origin.current = e.currentTarget;
                            setSelected(event);
                          }}
                        >
                          <span className="oc-flyer-pin" aria-hidden="true" />
                          <span className="sr-only">View event: </span><EventFlyer event={event} />
                        </button>
                      </DialogTrigger>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {selected && (
            <DialogContent
              className="oc-event-detail"
              onCloseAutoFocus={(e) => {
                if (origin.current?.isConnected) {
                  e.preventDefault();
                  origin.current.focus();
                }
              }}
            >
              <div className="oc-pulled-flyer" aria-hidden="true">
                <EventFlyer event={selected} />
              </div>
              <div className="oc-event-detail-copy">
                <p className="oc-eyebrow">{selected.category} · Event</p>
                <DialogTitle className="oc-event-title">
                  {selected.title}
                </DialogTitle>
                <DialogDescription>
                  Hosted by {selected.clubName}
                </DialogDescription>
                <dl className="oc-event-facts">
                  <div>
                    <dt>Date & time</dt>
                    <dd>
                      {eventScheduleLabel(selected)}
                    </dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{selected.location}</dd>
                  </div>
                  <div>
                    <dt>Students going</dt>
                    <dd>
                      {selected.rsvpCount}
                      {selected.capacity !== null
                        ? ` / ${selected.capacity} capacity · ${Math.max(0, selected.capacity - selected.rsvpCount)} remaining`
                        : ""}
                    </dd>
                  </div>
                </dl>
                {selected.capacity !== null && (
                  <progress
                    className="oc-event-capacity"
                    aria-label="RSVP capacity"
                    value={selected.rsvpCount}
                    max={selected.capacity}
                  />
                )}
                <p className="oc-event-description">{selected.description}</p>
                {selected.contact && (
                  <p className="text-sm">Contact: {selected.contact}</p>
                )}
                {selected.rsvpDeadline && (
                  <p className="text-sm text-muted-foreground">
                    RSVP by {eventDateLabel(selected.rsvpDeadline)} ·{" "}
                    {eventTimeLabel(selected.rsvpDeadline)}
                  </p>
                )}
                <p className="text-sm">
                  {selected.rsvpRequired
                    ? "RSVP required"
                    : selected.rsvpEnabled
                      ? "RSVP optional"
                      : "No RSVP required"}
                </p>
                <RsvpControls
                  key={`${selected.id}:${identity}`}
                  event={selected}
                  identity={identity}
                  onChanged={(count) => updateEvent(selected.id, count)}
                />
                <div className="oc-event-detail-actions">
                  <EventSaveButton event={selected} identity={identity} saved={saves.ids.has(selected.id)} ready={saves.ready} pending={saves.pending.has(selected.id)} onSave={() => void saveEvent(selected.id)} />
                  <EventCalendarButton event={selected} />
                </div>
                {saves.error && <p role="alert" className="mt-3 text-sm text-destructive">{saves.error}</p>}
                <Link
                  className="oc-event-permalink"
                  href={`/corkboard?event=${selected.id}`}
                >
                  Event link
                </Link>
              </div>
            </DialogContent>
          )}
        </Dialog>
      )}
      {identity && (
        <MyEventRsvps
          key={identity}
          onCancelled={(id) => {
            setEvents((rows) =>
              rows.map((e) =>
                e.id === id
                  ? { ...e, rsvpCount: Math.max(0, e.rsvpCount - 1) }
                  : e,
              ),
            );
          }}
        />
      )}
      {(filters.page || hasMore) && (
        <div className="oc-event-pagination">
          <Button
            variant="outline"
            disabled={loading || !filters.page}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                page: Math.max(0, (f.page || 0) - 1),
              }))
            }
          >
            Previous
          </Button>
          <span>Page {(filters.page || 0) + 1}</span>
          <Button
            variant="outline"
            disabled={loading || !hasMore}
            onClick={() =>
              setFilters((f) => ({ ...f, page: (f.page || 0) + 1 }))
            }
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
export function RsvpControls({
  event,
  identity,
  onChanged,
}: {
  event: CampusEvent;
  identity: string;
  onChanged: (count: number) => void;
}) {
  const [going, setGoing] = useState(false),
    [loading, setLoading] = useState(!!identity),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!identity) return;
    let active = true;
    setLoading(true);
    setUnavailable(false);
    setError("");
    getCampusEventRsvp(event.id)
      .then((r) => {
        if (active) setGoing(r.going);
      })
      .catch(() => {
        if (active) {
          setUnavailable(true);
          setError("Could not load your RSVP. Retry before continuing.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [event.id, identity, retry]);
  async function change(next: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await setCampusEventRsvp({ eventId: event.id, going: next });
      if (!r.ok) { setError(r.error); return; }
      setGoing(r.going);
      onChanged(r.count);
      window.dispatchEvent(new Event("outclass-event-rsvp"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update RSVP.");
    } finally {
      setBusy(false);
    }
  }
  const closed =
    !event.rsvpEnabled ||
    +new Date(event.date) <= Date.now() ||
    (event.rsvpDeadline && +new Date(event.rsvpDeadline) <= Date.now());
  const full = event.capacity !== null && event.rsvpCount >= event.capacity;
  if (!identity && (closed || full))
    return (
      <p className="text-sm text-muted-foreground">
        {closed ? "RSVP closed" : "Event full"}
      </p>
    );
  if (!identity)
    return (
      <Button asChild>
        <Link
          href={`/login?next=${encodeURIComponent(`/corkboard?event=${event.id}`)}`}
        >
          Sign in to RSVP
        </Link>
      </Button>
    );
  return (
    <div className="space-y-2" aria-busy={busy || loading} data-saving={busy}>
      {going ? (
        <>
          <p role="status" className="oc-youre-going">
            You’re going <Check size={16} className="inline-block align-text-bottom" />
          </p>
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => void change(false)}
          >
            Cancel RSVP
          </Button>
        </>
      ) : (
        <Button
          className="oc-rsvp-action"
          disabled={
            busy ||
            loading ||
            unavailable ||
            !!closed ||
            (event.capacity !== null && event.rsvpCount >= event.capacity)
          }
          onClick={() => void change(true)}
        >
          {loading
            ? "Loading RSVP…"
            : closed
              ? "RSVP closed"
              : event.capacity !== null && event.rsvpCount >= event.capacity
                ? "Event full"
                : "RSVP"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {unavailable && (
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          Retry RSVP
        </Button>
      )}
    </div>
  );
}
function MyEventRsvps({ onCancelled }: { onCancelled: (id: string) => void }) {
  const [rows, setRows] = useState<
      { eventId: string; title: string; available: boolean }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState("");
  const readVersion = useRef(0);
  useEffect(() => {
    let active = true;
    const load = () => {
      const version = ++readVersion.current;
      setLoading(true);
      setError("");
      return getMyCampusEventRsvps()
        .then((r) => {
          if (active && version === readVersion.current) setRows(r);
        })
        .catch(() => {
          if (active && version === readVersion.current) setError("Your RSVPs could not be loaded.");
        })
        .finally(() => { if (active && version === readVersion.current) setLoading(false); });
    };
    void load();
    window.addEventListener("outclass-event-rsvp", load);
    return () => {
      active = false;
      window.removeEventListener("outclass-event-rsvp", load);
    };
  }, [retry]);
  async function cancel(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await setCampusEventRsvp({ eventId: id, going: false });
      if (!r.ok) { setError(r.error); return; }
      ++readVersion.current;
      setLoading(false);
      setError("");
      setNotice("Your RSVP was cancelled.");
      setRows((r) => r.filter((e) => e.eventId !== id));
      onCancelled(id);
    } catch {
      setError("Could not cancel. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="oc-event-rsvps group mt-5 rounded-lg border p-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 -rotate-90 transition-transform duration-150 group-open:rotate-0 motion-reduce:transition-none" />
        Your RSVPs{!loading && !error && ` (${rows.length})`}
      </summary>
      <p className="my-3 text-xs text-muted-foreground">
        You can cancel here even if an event has been withdrawn or cancelled.
      </p>
      {error && (
        <p role="alert" className="text-sm">
          {error}{" "}
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </Button>
        </p>
      )}
      {loading && <LoadingState label="Loading your RSVPs…" layout="inline" />}
      {notice && <p role="status" className="my-3 text-sm">{notice}</p>}
      {!loading && !error && !rows.length && <div className="my-3 space-y-2 text-sm text-muted-foreground"><p>You haven’t RSVP’d to an event. Events you RSVP to also appear on your calendar.</p><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/calendar">Open your calendar</Link></div>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.eventId}
            className="flex items-center justify-between gap-3 text-sm"
          >
            {r.available ? (
              <Link
                href={`/corkboard?event=${r.eventId}`}
                className="underline"
              >
                {r.title}
              </Link>
            ) : (
              <span>{r.title}</span>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void cancel(r.eventId)}
            >
              {busy ? "Cancelling…" : "Cancel RSVP"}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
