"use client";
import { LoadingState } from "@/components/ui/loading-state"

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { turnstileRequired, TURNSTILE_PENDING } from "@/lib/turnstile";
import {
  newPassword,
  recoveryEmail,
  recoveryConfirmation,
} from "@/lib/password-recovery";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, passwordIssue } from "@/lib/password-policy";
import { PublicPageFrame } from "@/components/landing/public-page-frame";
import "@/components/auth/login.css";

export function PasswordRecovery({ mode }: { mode: "request" | "reset" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [authenticatorCode, setAuthenticatorCode] = useState("");
  const [tokenHash, setTokenHash] = useState("");
  const [ready, setReady] = useState(mode === "request");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
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
      setAuthenticatorCode("");
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
      setError(passwordIssue(password) ?? "Passwords must match.");
      return;
    }
    if (mode === "request" && turnstileRequired && !turnstileToken) {
      setError(TURNSTILE_PENDING);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "request"
            ? { action: mode, email, turnstileToken }
            : { action: mode, tokenHash, password, confirmation,
                ...(authenticatorCode ? { authenticatorCode } : {}) },
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
      setAuthenticatorCode("");
      setTokenHash("");
      setDone(true);
    } catch {
      setError(
        "Connection interrupted. Please try again. If your link has already been used, request another.",
      );
    } finally {
      setBusy(false);
      if (mode === "request") setTurnstileReset((value) => value + 1);
    }
  }

  return (
    <PublicPageFrame width="narrow" className="oc-auth-page">
      <div>
        <section className="oc-login-auth-content oc-recovery-card" aria-labelledby="recovery-title">
          <h1 id="recovery-title" className="oc-auth-title">{done
              ? mode === "request"
                ? "Check your inbox"
                : "Password updated"
              : mode === "request"
                ? "Forgot your password?"
                : "Choose a new password"}</h1>
          <p
            className="mt-4 text-base leading-7 text-muted-foreground"
            role={done ? "status" : undefined}
          >
            {done
              ? mode === "request"
                ? recoveryConfirmation
                : "Sign in with your new password to continue to OutClass."
              : mode === "request"
                ? "Enter your UVA email and we’ll help you get back to OutClass."
                : "Choose a new password you don’t use anywhere else."}
          </p>
          {!ready && (
            <LoadingState label="Preparing secure reset…" layout="inline" rows={3} className="mt-6" />
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
                      minLength={PASSWORD_MIN_LENGTH}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby="password-help"
                    />
                    <p
                      id="password-help"
                      className="text-control text-muted-foreground"
                    >
                      {PASSWORD_HINT} Spaces and password managers are
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
                      minLength={PASSWORD_MIN_LENGTH}
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-authenticator">Authenticator code (if enabled)</Label>
                    <Input
                      id="recovery-authenticator"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={authenticatorCode}
                      onChange={(e) => setAuthenticatorCode(e.target.value)}
                      aria-describedby="recovery-authenticator-help"
                    />
                    <p id="recovery-authenticator-help" className="text-control text-muted-foreground">
                      If your account uses two-step verification, enter a fresh six-digit code from your authenticator app.
                    </p>
                  </div>
                </>
              )}
              {mode === "request" && (
                <TurnstileWidget
                  action="password-recovery"
                  onToken={setTurnstileToken}
                  resetKey={turnstileReset}
                />
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="oc-login-submit w-full" disabled={busy} loading={busy}>
                {mode === "request"
                    ? "Send reset link"
                    : "Update password"}
              </Button>
            </form>
          )}
          <Link
            href="/login"
            className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </section>
      </div>
    </PublicPageFrame>
  );
}
