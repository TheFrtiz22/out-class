"use client";
import { useEffect, useState } from "react";
import {
  readPlatformResource,
  inspectPlatformRecord,
  changePlatformResource,
  type PlatformResource,
} from "@/actions/platform-admin";
import {
  platformResources,
  platformStatuses,
  type PlatformFilters,
} from "@/lib/platform-console";
import { clubPermissions, permissionLabels } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
type RecordRow = Record<string, unknown>;
const selectClass =
  "min-h-11 max-w-full rounded-md border border-input bg-card px-3 text-sm";
const labels: Record<PlatformResource, string> = {
  users: "Users",
  clubs: "Clubs",
  claims: "Club claims",
  memberships: "Memberships & permissions",
  rounds: "Recruitment rounds",
  questions: "Application questions",
  interviews: "Interview slots",
  applications: "Applications",
  meetings: "Meetings",
  tasks: "Tasks & projects",
  submissions: "Task submissions",
  content: "Demo & platform content",
  audit: "Audit log",
  "view-sessions": "View-as sessions",
};
const string = (v: unknown) => (typeof v === "string" ? v : "");
const nested = (r: RecordRow, key: string, field: string) =>
  r[key] && typeof r[key] === "object"
    ? string((r[key] as RecordRow)[field])
    : "";
function title(r: RecordRow) {
  return (
    string(r.name) ||
    string(r.email) ||
    string(r.title) ||
    string(r.key) ||
    nested(r, "user", "email") ||
    nested(r, "recipient", "email") ||
    string(r.action) ||
    string(r.prompt) ||
    string(r.id)
  );
}
function defaultOperation(resource: PlatformResource, r?: RecordRow) {
  const id = r ? { id: r.id } : {},
    clubId = string(r?.clubId);
  switch (resource) {
    case "view-sessions":
      return { kind: "view-session", ...id };
    case "users":
      return { kind: "user", ...id, disabled: !r?.disabledAt };
    case "clubs":
      return {
        kind: "club",
        ...id,
        name: r?.name ?? "",
        slug: r?.slug ?? "",
        tagline: r?.tagline ?? "",
        description: r?.description ?? "",
        category: r?.category ?? "",
        color: r?.color ?? "#17233b",
      };
    case "memberships":
      return {
        kind: "membership",
        clubId,
        userId: r?.userId ?? "",
        isOwner: r?.isOwner ?? false,
        permissions: r?.permissions ?? [],
      };
    case "rounds":
      return {
        kind: "round",
        ...id,
        clubId,
        name: r?.name ?? "",
        order: r?.order ?? 0,
        anonymousReview: r?.anonymousReview ?? false,
      };
    case "questions":
      return {
        kind: "question",
        ...id,
        clubId,
        prompt: r?.prompt ?? "",
        type: r?.type ?? "ESSAY",
        required: r?.required ?? true,
        wordLimit: r?.wordLimit ?? 250,
      };
    case "interviews":
      return {
        kind: "interview",
        clubId,
        startTime: "",
        endTime: "",
        location: "",
        capacity: 1,
      };
    case "applications":
      return {
        kind: "application",
        ...id,
        expectedStatus: r?.status ?? "SUBMITTED",
        status:
          r?.status === "SUBMITTED" ? "IN_REVIEW" : (r?.status ?? "IN_REVIEW"),
      };
    case "meetings":
      return {
        kind: "meeting",
        ...id,
        clubId,
        title: r?.title ?? "",
        date: r?.date ? new Date(String(r.date)).toISOString() : "",
        location: r?.location ?? "",
        isPublic: r?.isPublic ?? true,
      };
    case "tasks":
      return {
        kind: "task",
        ...id,
        clubId,
        title: r?.title ?? "",
        description: r?.description ?? "",
        status: r?.status ?? "OPEN",
        dueAt: r?.dueAt ? new Date(String(r.dueAt)).toISOString() : null,
      };
    case "content":
      return { kind: "content", key: r?.key ?? "", value: r?.value ?? {} };
    default:
      return null;
  }
}
const editable = [
  "view-sessions",
  "users",
  "clubs",
  "memberships",
  "rounds",
  "questions",
  "interviews",
  "applications",
  "meetings",
  "tasks",
  "content",
];
export function PlatformConsole() {
  const [resource, setResource] = useState<PlatformResource>("users"),
    [page, setPage] = useState(0),
    [filters, setFilters] = useState<PlatformFilters>({}),
    [rows, setRows] = useState<RecordRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<RecordRow | null>(null),
    [operation, setOperation] = useState<RecordRow | null>(null),
    [viewTarget, setViewTarget] = useState("");
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setRows([]);
    readPlatformResource(resource, page, filters)
      .then((data) => {
        if (current) setRows(data as unknown as RecordRow[]);
      })
      .catch(() => {
        if (current)
          setError(
            "Could not load records. Check filter values and administrator access, then retry.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [resource, page, filters, revision]);
  return (
    <div className="space-y-6">
      <nav
        aria-label="Platform records"
        className="flex flex-wrap gap-2 border-b pb-4"
      >
        {platformResources.map((r) => (
          <Button
            variant={resource === r ? "default" : "ghost"}
            size="sm"
            key={r}
            aria-pressed={resource === r}
            onClick={() => {
              setResource(r);
              setPage(0);
              setFilters({});
              setSelected(null);
              setOperation(null);
            }}
          >
            {labels[r]}
          </Button>
        ))}
      </nav>
      <form
        key={resource}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPage(0);
          setFilters({
            query: String(f.get("query") || ""),
            clubId: String(f.get("clubId") || ""),
            userId: String(f.get("userId") || ""),
            status: String(f.get("status") || ""),
            permission: String(f.get("permission") || ""),
            action: String(f.get("action") || ""),
            from: f.get("from")
              ? new Date(String(f.get("from")) + "T00:00:00Z").toISOString()
              : "",
            to: f.get("to")
              ? new Date(String(f.get("to")) + "T23:59:59.999Z").toISOString()
              : "",
          });
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 basis-full text-sm sm:flex-1 sm:basis-64">
            Search {labels[resource].toLowerCase()}
            <Input
              name="query"
              type="search"
              maxLength={200}
              placeholder="Name, email, record ID, or text"
            />
          </label>
          {platformStatuses[resource] && (
            <label className="text-sm">
              Status
              <select name="status" className={`block ${selectClass}`}>
                <option value="">All statuses</option>
                {platformStatuses[resource]!.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <Button disabled={loading}>Search</Button>
        </div>
        <details>
          <summary className="cursor-pointer py-2 text-sm">
            Advanced filters
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!["users", "content"].includes(resource) && (
              <label className="text-sm">
                Club UUID
                <Input name="clubId" />
              </label>
            )}
            {[
              "users",
              "claims",
              "memberships",
              "applications",
              "submissions",
              "audit",
              "view-sessions",
            ].includes(resource) && (
              <label className="text-sm">
                {resource === "audit" ? "Actor" : "User"} UUID
                <Input name="userId" />
              </label>
            )}
            {[
              "users",
              "claims",
              "interviews",
              "meetings",
              "tasks",
              "submissions",
              "audit",
              "content",
              "view-sessions",
            ].includes(resource) && (
              <>
                <label className="text-sm">
                  From (UTC)
                  <Input type="date" name="from" />
                </label>
                <label className="text-sm">
                  Through (UTC)
                  <Input type="date" name="to" />
                </label>
              </>
            )}
            {resource === "audit" && (
              <label className="text-sm">
                Action contains
                <Input
                  name="action"
                  placeholder="claim · membership · view-as"
                />
              </label>
            )}
            {resource === "memberships" && (
              <label className="text-sm">
                Capability
                <select
                  className={`block w-full ${selectClass}`}
                  name="permission"
                >
                  <option value="">Any</option>
                  {clubPermissions.map((p) => (
                    <option key={p} value={p}>
                      {permissionLabels[p]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </details>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{labels[resource]}</h2>
        {editable.includes(resource) &&
          !["users", "applications", "view-sessions"].includes(resource) && (
            <Button
              variant="outline"
              onClick={() => {
                setOperation(defaultOperation(resource));
                setSelected(null);
              }}
            >
              Create{" "}
              {resource === "memberships"
                ? "membership"
                : resource === "content"
                  ? "content"
                  : resource.slice(0, -1)}
            </Button>
          )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <button
            className="underline"
            onClick={() => setRevision((n) => n + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status" className="py-10">
          Loading protected records…
        </p>
      ) : !rows.length ? (
        <p className="py-10 text-sm text-muted-foreground">
          No records match these filters.
        </p>
      ) : (
        <ul className="divide-y border-y">
          {rows.map((r, i) => (
            <li
              key={string(r.id) || i}
              className="flex flex-wrap items-start justify-between gap-3 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{title(r)}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {string(r.id)}
                  {nested(r, "club", "name")
                    ? ` · ${nested(r, "club", "name")}`
                    : ""}
                  {r.status ? ` · ${r.status}` : ""}
                  {r.createdAt
                    ? ` · ${new Date(String(r.createdAt)).toISOString().slice(0, 10)}`
                    : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setSelected(r);
                  setOperation(null);
                  if (
                    ["users", "applications", "meetings", "tasks"].includes(
                      resource,
                    )
                  ) {
                    try {
                      setSelected(
                        (await inspectPlatformRecord(
                          resource,
                          string(r.id),
                        )) as RecordRow | null,
                      );
                    } catch {
                      setError(
                        "Could not inspect this record. Verify access and try again.",
                      );
                    }
                  }
                }}
              >
                Inspect<span className="sr-only"> {title(r)}</span>
              </Button>
              {editable.includes(resource) &&
                resource !== "interviews" &&
                !(resource === "applications" && r.status === "DRAFTING") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelected(r);
                      setOperation(defaultOperation(resource, r));
                    }}
                  >
                    Manage
                  </Button>
                )}
              {resource === "users" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewTarget(string(r.id))}
                >
                  View as
                </Button>
              )}
              {resource === "claims" && (
                <a
                  className="self-center text-sm underline"
                  href="/platform/claims"
                >
                  Review claim
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={loading || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">Page {page + 1} · up to 100 records</span>
        <Button
          variant="outline"
          disabled={loading || rows.length < 100}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
      {selected && !operation && (
        <section className="space-y-3 border-t pt-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Record details</h3>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <pre className="max-h-[32rem] overflow-auto rounded border bg-card p-4 text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </section>
      )}
      {operation && (
        <OperationEditor
          key={JSON.stringify(operation)}
          initial={operation}
          onClose={() => setOperation(null)}
          onSaved={() => {
            setOperation(null);
            setSelected(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
      {viewTarget && (
        <ViewAsForm userId={viewTarget} onClose={() => setViewTarget("")} />
      )}
      <details className="border-t pt-5">
        <summary className="cursor-pointer text-sm font-medium">
          Platform upkeep
        </summary>
        <p className="my-3 max-w-3xl text-sm text-muted-foreground">
          Use Users for account suspension, Memberships for access repair, and
          Demo & platform content for validated example data. Database
          migrations, administrator provisioning, storage policies, and backups
          remain operator-managed; this console does not run arbitrary SQL or
          bulk deletes.
        </p>
        <p className="text-sm">
          Protected by server allowlist, an active database grant, and MFA.
          View-as is read-only and expires after 30 minutes.
        </p>
      </details>
    </div>
  );
}
function OperationEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: RecordRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const field = (name: string, next: unknown) =>
    setValue((v) => ({ ...v, [name]: next }));
  return (
    <form
      className="space-y-4 rounded-md border p-4 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm !== "APPLY" || error === "Content must be valid JSON.")
          return;
        setBusy(true);
        setError("");
        try {
          await changePlatformResource(value, reason);
          onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Change failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="text-lg font-semibold">Review platform change</h3>
      <p className="text-sm text-muted-foreground">
        This changes real platform data. Verify the target and values before
        applying.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(value).map(([name, v]) => {
          if (name === "kind" || name === "id" || name === "expectedStatus")
            return (
              <div className="break-all text-sm" key={name}>
                <span className="font-medium">{name}:</span> {String(v)}
              </div>
            );
          if (name === "permissions")
            return (
              <fieldset key={name} className="sm:col-span-2">
                <legend className="mb-2 text-sm font-medium">
                  Granular permissions
                </legend>
                <div className="grid gap-1 sm:grid-cols-2">
                  {clubPermissions.map((p) => (
                    <label
                      className="flex min-h-11 items-center gap-2 text-sm"
                      key={p}
                    >
                      <input
                        type="checkbox"
                        checked={(v as string[]).includes(p)}
                        onChange={(e) =>
                          field(
                            name,
                            e.target.checked
                              ? [...(v as string[]), p]
                              : (v as string[]).filter((x) => x !== p),
                          )
                        }
                      />
                      {permissionLabels[p]}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          if (typeof v === "boolean")
            return (
              <label
                className="flex min-h-11 items-center gap-2 text-sm"
                key={name}
              >
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) => field(name, e.target.checked)}
                />
                {name === "disabled"
                  ? "Suspend account"
                  : name === "isOwner"
                    ? "Club owner (all club capabilities)"
                    : name}
              </label>
            );
          if (name === "value")
            return (
              <label className="block text-sm sm:col-span-2" key={name}>
                Content JSON
                <Textarea
                  rows={8}
                  className="font-mono"
                  defaultValue={JSON.stringify(v, null, 2)}
                  onChange={(e) => {
                    try {
                      field(name, JSON.parse(e.target.value));
                      setError("");
                    } catch {
                      setError("Content must be valid JSON.");
                    }
                  }}
                />
              </label>
            );
          const options =
            name === "status"
              ? value.kind === "task"
                ? ["OPEN", "IN_PROGRESS", "DONE"]
                : [
                    "IN_REVIEW",
                    "INTERVIEWING",
                    "ACCEPTED",
                    "REJECTED",
                    "WAITLISTED",
                  ]
              : name === "type"
                ? ["ESSAY", "FILE_UPLOAD", "MULTIPLE_CHOICE"]
                : null;
          return (
            <label
              className={`block text-sm ${["description", "prompt"].includes(name) ? "sm:col-span-2" : ""}`}
              key={name}
            >
              {name}
              {options ? (
                <select
                  className={`block w-full ${selectClass}`}
                  value={String(v)}
                  onChange={(e) => field(name, e.target.value)}
                >
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : ["description", "prompt"].includes(name) ? (
                <Textarea
                  value={String(v ?? "")}
                  rows={4}
                  onChange={(e) => field(name, e.target.value)}
                />
              ) : (
                <Input
                  value={v === null ? "" : String(v)}
                  type={typeof v === "number" ? "number" : "text"}
                  placeholder={
                    ["date", "dueAt", "startTime", "endTime"].includes(name)
                      ? "ISO date/time, e.g. 2026-10-01T18:00:00Z"
                      : ""
                  }
                  onChange={(e) =>
                    field(
                      name,
                      typeof v === "number"
                        ? Number(e.target.value)
                        : name === "dueAt" && !e.target.value
                          ? null
                          : e.target.value,
                    )
                  }
                  required={name !== "dueAt" && name !== "tagline"}
                />
              )}
            </label>
          );
        })}
      </div>
      <label className="block text-sm">
        Reason (at least 10 characters)
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={10}
          maxLength={1000}
          required
        />
      </label>
      <details>
        <summary className="cursor-pointer text-sm">
          Exact operation to be audited
        </summary>
        <pre className="mt-3 max-h-64 overflow-auto text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
      <label className="block text-sm">
        Type APPLY to confirm
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          pattern="APPLY"
          autoComplete="off"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          disabled={
            busy ||
            confirm !== "APPLY" ||
            reason.trim().length < 10 ||
            error === "Content must be valid JSON."
          }
        >
          {busy ? "Applying…" : "Apply audited change"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
function ViewAsForm({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4 border-t pt-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/platform/view-as", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "start",
              userId,
              clubId: String(f.get("clubId") || "") || undefined,
              reason: String(f.get("reason")),
              confirmation: String(f.get("confirmation")),
            }),
          });
          if (!response.ok)
            throw Error(
              (await response.json()).error || "Could not start view-as.",
            );
          window.location.assign("/platform/view-as");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not start view-as.");
          setBusy(false);
        }
      }}
    >
      <h3 className="text-lg font-semibold">Start read-only view-as</h3>
      <p className="break-all text-sm">User: {userId}</p>
      <p className="text-sm text-muted-foreground">
        Retains your admin login. The target&#39;s permissions determine the support
        snapshot. No writes, target tokens, or delegated privileges.
      </p>
      <label className="block text-sm">
        Optional club workspace UUID
        <Input name="clubId" />
      </label>
      <label className="block text-sm">
        Support reason
        <Textarea name="reason" minLength={10} maxLength={1000} required />
      </label>
      <label className="block text-sm">
        Type VIEW ONLY to start
        <Input
          name="confirmation"
          pattern="VIEW ONLY"
          required
          autoComplete="off"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button disabled={busy}>Start view-as</Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
