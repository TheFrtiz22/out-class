"use client";
import Link from "next/link";
import { notifySupportSessionChanged } from "@/components/support-session-sync";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export function PlatformViewBanner({
  label,
  expiresAt,
}: {
  label: string;
  expiresAt?: string;
}) {
  const banner = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = banner.current;
    if (!element) return;
    const resize = new ResizeObserver(() => document.documentElement.style.setProperty("--support-banner-height", `${element.getBoundingClientRect().height}px`));
    resize.observe(element);
    const timer = expiresAt ? window.setTimeout(() => window.location.assign("/platform/view-as"), Math.max(0, new Date(expiresAt).getTime() - Date.now()) + 1000) : undefined;
    return () => { resize.disconnect(); window.clearTimeout(timer); document.documentElement.style.removeProperty("--support-banner-height"); };
  }, [expiresAt]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <aside ref={banner}
      aria-label="Administrator view-as session"
      className="pointer-events-auto fixed inset-x-0 top-0 z-[2147483000] border-b border-amber-300 bg-amber-50 px-4 py-3 text-slate-950"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <p className="break-words text-sm font-semibold">
            Viewing as {label}
          </p>
          <p className="mt-1 text-xs">
            Support session · Changes are real and audited. Your admin login is retained.
            {expiresAt
              ? ` View expires ${expiresAt.slice(11, 16) + " UTC"}.`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/platform/view-as" className="self-center text-sm underline">
            View session
          </Link>
          <Button
            disabled={busy}
            variant="outline"
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/platform/view-as", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "end" }),
                });
                if (!response.ok) throw Error("Could not exit. Please retry.");
                notifySupportSessionChanged();
                window.location.assign("/platform");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not exit.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Exiting…" : "Return to Admin"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="w-full text-sm">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}
