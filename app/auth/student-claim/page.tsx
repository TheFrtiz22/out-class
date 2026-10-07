"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/product/page-header";
export default function StudentClaimPage() {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [tokenHash, setTokenHash] = useState("");
  useEffect(() => { setTokenHash(new URLSearchParams(window.location.hash.slice(1)).get("token_hash") || ""); window.history.replaceState(null, "", "/auth/student-claim"); }, []);
  return <main className="mx-auto max-w-lg space-y-5 p-8"><PageHeader title="Claim your OutClass account" description="Choose your own password. Use the UVA address that received the invitation." />
    <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try {
      const response = await fetch("/api/auth/student-claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, tokenHash }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      window.history.replaceState(null, "", "/auth/student-claim"); window.location.assign("/?workspace=student");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not claim invitation."); setBusy(false); } }}>
      <label className="block">UVA email<Input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block">New password<Input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <Button disabled={busy}>{busy ? "Claiming…" : "Claim account"}</Button><p role="alert">{error}</p>
    </form></main>;
}
