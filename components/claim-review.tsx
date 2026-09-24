"use client";
import { useState } from "react";
import { listClubClaims } from "@/actions/club-claims";
import { changePlatformResource } from "@/actions/platform-admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
export function ClaimReview({
  initial,
}: {
  initial: Awaited<ReturnType<typeof listClubClaims>>;
}) {
  const [claims, setClaims] = useState(initial),
    [status, setStatus] = useState("PENDING"),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(next: string, index: number) {
    setBusy(true);
    setError("");
    try {
      setClaims(await listClubClaims(next, index));
      setStatus(next);
      setPage(index);
    } catch {
      setError("Could not load claims. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <label>
        Status{" "}
        <select
          className="ml-3 rounded border p-2"
          value={status}
          disabled={busy}
          onChange={(e) => void load(e.target.value, 0)}
        >
          {["PENDING", "APPROVED", "REJECTED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {!claims.length && <p>No {status.toLowerCase()} claims on this page.</p>}
      {claims.map((claim) => (
        <section key={claim.id} className="space-y-3 border-t py-5">
          <h2 className="text-xl font-semibold">{claim.club.name}</h2>
          <p className="break-all">
            {claim.user.email} · {claim.status.toLowerCase()}
          </p>
          <p className="whitespace-pre-wrap break-words">{claim.explanation}</p>
          {claim.status === "PENDING" && (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const submitter = (e.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement;
                setBusy(true);
                setError("");
                try {
                  await changePlatformResource(
                    {
                      kind: "claim",
                      id: claim.id,
                      approved: submitter.value === "approve",
                    },
                    String(form.get("reason")),
                  );
                  setClaims(await listClubClaims(status, page));
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not review claim.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor={`reason-${claim.id}`}>
                Review rationale (saved in audit history)
              </label>
              <Textarea
                id={`reason-${claim.id}`}
                name="reason"
                required
                minLength={10}
                maxLength={1000}
                disabled={busy}
              />
              <div className="flex gap-3">
                <Button type="submit" value="approve" disabled={busy}>
                  Approve ownership
                </Button>
                <Button
                  type="submit"
                  value="reject"
                  variant="outline"
                  disabled={busy}
                >
                  Reject
                </Button>
              </div>
            </form>
          )}
          <details>
            <summary className="cursor-pointer">Audit history</summary>
            <ul className="space-y-2 py-3 text-sm">
              {claim.history.map((h) => (
                <li key={h.id}>
                  {new Date(h.createdAt).toISOString()} · {h.action} · Actor{" "}
                  {h.actorId}
                  {h.reason && <p>{h.reason}</p>}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
      <div className="flex gap-3">
        <Button
          variant="outline"
          disabled={busy || page === 0}
          onClick={() => void load(status, page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={busy || claims.length < 50}
          onClick={() => void load(status, page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
