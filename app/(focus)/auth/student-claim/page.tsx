"use client";
import { UserFacingError } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { turnstileRequired, TURNSTILE_PENDING } from "@/lib/turnstile";
export default function StudentClaimPage() {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [tokenHash, setTokenHash] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null), [turnstileReset, setTurnstileReset] = useState(0);
  useEffect(() => { setTokenHash(new URLSearchParams(window.location.hash.slice(1)).get("token_hash") || ""); window.history.replaceState(null, "", "/auth/student-claim"); }, []);
  return <div className="space-y-5"><PageHeader title="Claim your OutClass account" description="Choose your own password. Use the UVA address that received the invitation." />
    <form className="oc-form-section" onSubmit={async e => { e.preventDefault(); if (turnstileRequired && !turnstileToken) { setError(TURNSTILE_PENDING); return; } setBusy(true); setError(""); try {
      const response = await fetch("/api/auth/student-claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, tokenHash, ...(turnstileToken ? { turnstileToken } : {}) }) });
      const result = await response.json(); if (!response.ok) throw new UserFacingError(result.error);
      window.history.replaceState(null, "", "/auth/student-claim"); window.location.assign("/home");
    } catch (err) { setError(userMessage(err, "Could not claim invitation.")); setBusy(false); setTurnstileReset(value => value + 1); /* tokens are single use */ } }}>
      <label className="oc-field">UVA email<Input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="oc-field">New password<Input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <TurnstileWidget action="student-claim" onToken={setTurnstileToken} resetKey={turnstileReset} />
      <Button disabled={busy}>{busy ? "Claiming…" : "Claim account"}</Button><p role="alert">{error}</p>
    </form></div>;
}
