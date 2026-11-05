/** Ballot choices are private to the voter. Historical legacy audit rows
 * (`voting.ballot.submitted`, written before Nov 2026) stored the choice; they are
 * retained unchanged in the database, but no OutClass view returns that field. */
export function redactBallotAudit<T extends { action: string; details: unknown }>(row: T): T {
  if (!row.action.startsWith("voting.ballot.") && !row.action.startsWith("voting.room.ballot.")) return row;
  if (!row.details || typeof row.details !== "object" || Array.isArray(row.details)) return row;
  const { decision: _decision, choice: _choice, ...details } = row.details as Record<string, unknown>;
  return { ...row, details };
}
