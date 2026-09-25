"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function PlatformViewBanner({
  label,
  expiresAt,
}: {
  label: string;
  expiresAt?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <aside
      aria-label="Administrator view-as session"
      className="sticky top-0 z-[100] border-b border-amber-300 bg-amber-50 px-4 py-3 text-slate-950"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            Read-only administrator view · {label}
          </p>
          <p className="mt-1 text-xs">
            Original admin session retained. All changes are blocked until exit.
            {expiresAt
              ? ` View expires ${expiresAt.slice(11, 16) + " UTC"}.`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/platform/view-as" className="self-center text-sm underline">
            View session
          </a>
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
                window.location.assign("/platform");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not exit.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Exiting…" : "Exit view-as"}
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
