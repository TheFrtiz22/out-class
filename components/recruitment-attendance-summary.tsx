"use client";
import { useEffect, useState } from "react";
import { recruitmentAttendanceSummary } from "@/lib/workspace-api";
export function RecruitmentAttendanceSummary({
  clubId,
  applicationId,
}: {
  clubId: string;
  applicationId: string;
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
  return (
    <p className="text-xs text-muted-foreground">
      {error
        ? "Interest-meeting attendance unavailable."
        : !value
          ? "Loading interest-meeting attendance…"
          : `Attended ${value.attended} of ${value.held} recorded interest meetings held to date. Attendance is factual context, not a score.`}
    </p>
  );
}
