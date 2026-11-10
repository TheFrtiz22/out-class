"use client";
import { useEffect, useState } from "react";
import { recruitmentAttendanceSummary } from "@/lib/workspace-api";
export function RecruitmentAttendanceSummary({
  clubId,
  applicationId,
  compact = false,
}: {
  clubId: string;
  applicationId: string;
  /** "Interest meetings 1/3": a short fact for the quick review header. */
  compact?: boolean;
}) {
  const [value, setValue] = useState<{ held: number; attended: number } | null>(
      null,
    ),
    [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    setValue(null);
    setError(false);
    recruitmentAttendanceSummary(clubId, applicationId)
      .then((result) => {
        if (current) setValue(result);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [clubId, applicationId]);
  if (compact)
    return (
      <span className="text-xs text-muted-foreground" title={value ? `Attended ${value.attended} of ${value.held} recorded interest meetings held to date` : undefined}>
        {error ? "Interest meetings unavailable" : !value ? "Interest meetings …" : `Interest meetings ${value.attended}/${value.held}`}
      </span>
    );
  return (
    <p className="text-xs text-muted-foreground">
      {error
        ? "Interest-meeting attendance unavailable."
        : !value
          ? "Loading interest-meeting attendance…"
          : `Attended ${value.attended} of ${value.held} recorded interest meetings held to date.`}
    </p>
  );
}
