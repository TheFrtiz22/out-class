"use client"
import { useEffect, useState } from "react"
import {
  readPlatformResource,
  changePlatformResource,
  inspectPlatformUser,
  type PlatformResource,
} from "@/actions/platform-admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
const resources: PlatformResource[] = [
  "users",
  "clubs",
  "claims",
  "memberships",
  "rounds",
  "questions",
  "interviews",
  "applications",
  "meetings",
  "tasks",
  "content",
  "audit",
]
export function PlatformConsole() {
  const [page, setPage] = useState(0)
  const [resource, setResource] = useState<PlatformResource>("users"),
    [records, setRecords] = useState<unknown>([]),
    [payload, setPayload] = useState('{"kind":"user","id":"USER_UUID","disabled":false}'),
    [reason, setReason] = useState(""),
    [userId, setUserId] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    setRecords([])
    readPlatformResource(resource, page)
      .then((data) => {
        if (current) setRecords(data)
      })
      .catch(() => {
        if (current)
          setMessage("Access denied or service unavailable. Verify your administrator session.")
      })
    return () => {
      current = false
    }
  }, [resource, page])
  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setMessage("")
    try {
      await fn()
      setMessage("Operation recorded in the audit log.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not complete operation.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-6">
      <label className="block">
        Records
        <select
          className="ml-3 rounded border p-3"
          value={resource}
          onChange={(e) => {
            setPage(0)
            setResource(e.target.value as PlatformResource)
          }}
        >
          {resources.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={!page || busy} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span>Page {page + 1}</span>
        <Button
          variant="outline"
          disabled={busy || !Array.isArray(records) || records.length < 100}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing at most 100 records. Operations require exact IDs and a justification.
      </p>
      <pre className="max-h-96 overflow-auto rounded border bg-card p-4 text-xs">
        {JSON.stringify(records, null, 2)}
      </pre>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (window.confirm("Apply this audited platform change?"))
            void run(async () => {
              await changePlatformResource(JSON.parse(payload), reason)
              setRecords(await readPlatformResource(resource, page))
            })
        }}
      >
        <label className="block">
          Validated operation JSON
          <textarea
            className="mt-2 min-h-40 w-full rounded border p-3 font-mono text-sm"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            required
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Supported kinds: user, club, claim, membership, round, question, interview, application,
          meeting, task, content. Schema and examples are in docs/authorization.md. Unknown fields
          never confer privileges.
        </p>
        <label className="block">
          Reason
          <Input
            minLength={10}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>
        <Button disabled={busy}>Apply audited change</Button>
      </form>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            setRecords(await inspectPlatformUser(userId, reason))
          })
        }}
      >
        <Input
          className="max-w-md"
          aria-label="User UUID to inspect"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />
        <Button variant="outline" disabled={busy || reason.trim().length < 10}>
          Read-only user inspection
        </Button>
      </form>
      <p role="status">{message}</p>
    </div>
  )
}
