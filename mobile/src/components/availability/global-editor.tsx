import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AvailabilityEditor } from "~/components/availability/editor";
import { Card, ErrorState, Skeleton, TARGET } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { readDocument, type MyAvailability } from "~/lib/availability";
import { useApiQuery } from "~/lib/query";

export const MY_AVAILABILITY = ["availability.mine", null] as const;

export function AvailabilityLoading({ label }: { label: string }) {
  return (
    <Card accessibilityLabel={label} accessibilityRole="progressbar" style={{ gap: 12 }}>
      <Skeleton width="100%" height={TARGET} />
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} width="100%" height={TARGET} />)}
    </Card>
  );
}

/**
 * The person's global weekly schedule, shared by every club: loads `availability.mine` and edits it with
 * autosave. Settings → Availability and the Calendar's Availability view both show this one editor.
 */
export function GlobalAvailabilityEditor({ readOnly, onPaintingChange }: { readOnly?: boolean; onPaintingChange?: (painting: boolean) => void }) {
  const client = useQueryClient();
  const query = useApiQuery<MyAvailability>("availability.mine");
  const [nonce, setNonce] = useState(0);
  const reload = async () => { await query.refetch(); setNonce(value => value + 1); };
  if (query.data) {
    return (
      <AvailabilityEditor key={`global:${nonce}`} initial={readDocument(query.data.document)} readOnly={readOnly} onPaintingChange={onPaintingChange}
        onSaved={saved => {
          client.setQueryData<MyAvailability>(MY_AVAILABILITY, old => old && { ...old, document: saved });
          // Each round's prefill comes from the global schedule.
          void client.invalidateQueries({ queryKey: ["availability.round"], refetchType: "none" });
        }}
        onReload={() => { void reload(); }} />
    );
  }
  if (query.isError) return <Card><ErrorState message={errorMessage(query.error, "Couldn’t load your availability.")} offline={query.error instanceof ApiError && query.error.unreachable} onRetry={() => { void query.refetch(); }} /></Card>;
  return <AvailabilityLoading label="Loading your availability…" />;
}
