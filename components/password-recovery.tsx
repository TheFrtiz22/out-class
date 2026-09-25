"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { OutClassLogo } from "@/components/outclass-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  newPassword,
  recoveryEmail,
  recoveryConfirmation,
} from "@/lib/password-recovery";

export function PasswordRecovery({ mode }: { mode: "request" | "reset" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [tokenHash, setTokenHash] = useState("");
  const [ready, setReady] = useState(mode === "request");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (mode !== "reset") return;
    function readLink() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const token = fragment.get("token_hash") || "";
      // Keep the bearer token in memory only, away from history and referrers.
      window.history.replaceState(null, "", window.location.pathname);
      setTokenHash(token);
      setInvalid(!/^[A-Za-z0-9_-]{16,512}$/.test(token));
      setDone(false);
      setError("");
      setPassword("");
      setConfirmation("");
      setReady(true);
    }
    if (!initialized.current) {
      initialized.current = true;
      readLink();
    }
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (mode === "request" && !recoveryEmail.safeParse(email).success) {
      setError("Enter a valid UVA email address.");
      return;
    }
    if (
      mode === "reset" &&
      (!newPassword.safeParse(password).success || password !== confirmation)
    ) {
      setError("Use matching passwords of 8–128 characters.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "request"
            ? { action: mode, email }
            : { action: mode, tokenHash, password, confirmation },
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to continue. Please try again.");
        if (data.needsNewLink) setInvalid(true);
        return;
      }
      setPassword("");
      setConfirmation("");
      setTokenHash("");
      setDone(true);
    } catch {
      setError(
        "Connection interrupted. Please try again. If your link has already been used, request another.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-svh bg-background px-5 py-8 text-foreground sm:py-12">
      <div className="mx-auto max-w-md">
        <Link href="/" aria-label="OutClass home" className="inline-block">
          <OutClassLogo variant="light" className="h-8 w-auto" />
        </Link>
        <section className="py-14 sm:py-20" aria-labelledby="recovery-title">
          <ShieldCheck
            className="mb-6 size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <h1
            id="recovery-title"
            className="font-display text-3xl tracking-tight"
          >
            {done
              ? mode === "request"
                ? "Check your inbox."
                : "Password updated."
              : mode === "request"
                ? "Forgot your password?"
                : "Choose a new password."}
          </h1>
          <p
            className="mt-4 text-sm leading-6 text-muted-foreground"
            role={done ? "status" : undefined}
          >
            {done
              ? mode === "request"
                ? recoveryConfirmation
                : "Sign in with your new password to continue to OutClass."
              : mode === "request"
                ? "Enter your UVA email and we’ll help you get back to OutClass."
                : "Use a unique password of at least 8 characters. Your account’s security requirements also apply."}
          </p>
          {!ready && (
            <p role="status" className="mt-6">
              Preparing secure reset…
            </p>
          )}
          {ready && invalid && !done && (
            <div className="mt-6 space-y-4">
              <p role="alert" className="text-sm text-destructive">
                {error ||
                  "This reset link is missing, invalid, or no longer available. Open the link from your email again, or request a new one."}
              </p>
              <Button asChild>
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
            </div>
          )}
          {ready && !invalid && !done && (
            <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={busy}>
              {mode === "request" ? (
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">UVA email</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="computingid@virginia.edu"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby="password-help"
                    />
                    <p
                      id="password-help"
                      className="text-xs text-muted-foreground"
                    >
                      8–128 characters. Spaces and password managers are
                      welcome.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">
                      Confirm new password
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </div>
                </>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && (
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {busy
                  ? "Please wait…"
                  : mode === "request"
                    ? "Send reset link"
                    : "Update password"}
              </Button>
            </form>
          )}
          <Link
            href="/login"
            className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </section>
      </div>
    </main>
  );
}
