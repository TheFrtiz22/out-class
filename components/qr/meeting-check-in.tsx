"use client";
import { PageHeader } from "@/components/product/page-header";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-mode";
import { checkInMeeting as checkInLive, getMeeting as getMeetingLive } from "@/actions/meetings";

// Students open this page on a phone right after scanning. Import the two live
// Server Actions directly; the full workspace adapter (every feature plus the
// demo store and seed data) loads only when Demo Mode is enabled.
const demoWorkspace = () => import("@/lib/workspace-api");
async function getMeeting(demo: boolean, id: string) {
  return demo ? (await demoWorkspace()).getMeeting(id) : getMeetingLive(id);
}
async function checkInMeeting(demo: boolean, id: string, token: string) {
  return demo ? (await demoWorkspace()).checkInMeeting(id, token) : checkInLive(id, token);
}
import type { CheckInResult } from "@/lib/meetings";
import { Button } from "@/components/ui/button";
export function MeetingCheckIn() {
  const { user, loading } = useAuth(),
    demo = useDemoMode();
  const [id, setId] = useState(""),
    [token, setToken] = useState(""),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<CheckInResult | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    setId(url.searchParams.get("meetingId") || "");
    setToken(
      (previous) =>
        previous ||
        new URLSearchParams(url.hash.slice(1)).get("token") ||
        url.searchParams.get("token") ||
        "",
    );
    if (url.hash)
      window.history.replaceState(null, "", url.pathname + url.search);
  }, []);
  useEffect(() => {
    let current = true;
    if (user && id)
      getMeeting(demo.isDemoEnabled, id)
        .then((m) => {
          if (current) setTitle(m.title);
        })
        .catch(() => {
          if (current) setError("Meeting unavailable or access denied.");
        });
    return () => {
      current = false;
    };
  }, [user?.id, id]);
  return (
    <div className="space-y-5">
      <PageHeader title="Meeting check-in" />
      {demo.isDemoEnabled && (
        <p className="text-sm text-muted-foreground">
          Demo check-in is local to this browser. It does not record real
          attendance.
        </p>
      )}
      {loading ? (
        <LoadingState label="Checking your session…" layout="inline" rows={3} />
      ) : !user ? (
        <>
          <p>
            Sign in with your UVA account, then scan the current code again.
            Codes expire quickly to protect attendance.
          </p>
          <a
            className="underline"
            href={`/?next=${encodeURIComponent(`/check-in?meetingId=${id}`)}`}
          >
            Sign in
          </a>
        </>
      ) : !id || !token ? (
        <p role="alert">
          This link does not contain a current meeting code. Scan the QR
          displayed by the meeting leader. Static attendance links are no longer
          accepted.
        </p>
      ) : result ? (
        <div role="status">
          <h2 className="oc-section-heading ">
            {result.status === "already-checked-in"
              ? "You’re already checked in"
              : "You’re checked in"}
          </h2>
          <p className="mt-3">{title}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Recorded {new Date(result.checkedInAt).toLocaleString()}. Your
            original attendance timestamp is preserved.
          </p>
        </div>
      ) : (
        <>
          <p>{title || "Confirm your attendance at this meeting."}</p>
          <Button
            disabled={busy || !title}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setResult(await checkInMeeting(demo.isDemoEnabled, id, token));
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Check-in failed. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Checking in…" : "Check in"}
          </Button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <a
        className="block text-sm underline"
        href={id ? `/meetings/${id}` : "/meetings"}
      >
        Meeting agenda and resources
      </a>
    </div>
  );
}
