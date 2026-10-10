"use client";
import { useState } from "react";
import { getDurableNotifications } from "@/actions/communications";
import { useApplicationState } from "@/lib/application-state";
import { Button } from "@/components/ui/button";
export function CommunicationsInbox() {
  const { durableCursor, syncDurableNotifications } = useApplicationState();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function more() {
    if (!durableCursor || busy) return;
    setBusy(true); setError("");
    try { syncDurableNotifications(await getDurableNotifications(durableCursor), true); }
    catch { setError("Could not load more updates. Please try again."); }
    finally { setBusy(false); }
  }
  return <>{durableCursor && <Button variant="outline" disabled={busy} onClick={() => void more()}>{busy ? "Loading…" : "Load older updates"}</Button>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</>;
}
