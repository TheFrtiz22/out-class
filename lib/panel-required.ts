/**
 * How many interviewers a draft session needs after regeneration. A leader's change to one draft session
 * (`required` differs from the room's figure it started from, `originalRequired`) is kept while the room's own
 * figure is unchanged. When the room's "interviewers per slot" changes, the room's new figure wins: keeping the
 * old one left every session asking for an interviewer the leader had just said it no longer needs.
 */
export function regeneratedRequired(roomRequired: number, baseline?: { required: number; originalRequired?: number; unstaffOnly?: boolean } | null): number {
  if (!baseline || baseline.unstaffOnly || baseline.originalRequired === undefined) return roomRequired
  const leaderChanged = baseline.required !== baseline.originalRequired
  return leaderChanged && baseline.originalRequired === roomRequired ? baseline.required : roomRequired
}
