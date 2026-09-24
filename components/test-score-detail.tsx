export function TestScoreDetail({
  profile,
}: {
  profile:
    | {
        actEnglish?: number | null;
        actMath?: number | null;
        actReading?: number | null;
        actScience?: number | null;
      }
    | null
    | undefined;
}) {
  if (!profile) return null;
  const entries = [
    ["English", profile.actEnglish],
    ["Math", profile.actMath],
    ["Reading", profile.actReading],
    ["Science", profile.actScience],
  ] as const;
  if (!entries.some(([, value]) => value != null)) return null;
  return (
    <p className="text-xs text-muted-foreground">
      ACT sections:{" "}
      {entries
        .filter(([, value]) => value != null)
        .map(([label, value]) => `${label} ${value}`)
        .join(" · ")}
    </p>
  );
}
