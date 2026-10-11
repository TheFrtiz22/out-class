"use client";
// Old workspace URLs retain a clear unavailable state; no messaging calls run.
export function ClubMessaging({ clubId: _clubId }: { clubId?: string }) {
  return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Direct messaging is not available in OutClass.</p>;
}
