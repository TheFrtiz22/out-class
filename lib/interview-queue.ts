type Candidate = {
  id: string;
  name: string;
  roundId: string;
  assignedRoundIds: string[];
  completedRoundIds: string[];
};

/** Keep the workspace's existing name/ID order, including read-only reopening. */
export function interviewQueue<T extends Candidate>(applications: T[], roundId: string): T[] {
  return applications.filter(app => app.assignedRoundIds.includes(roundId) &&
    (app.roundId === roundId || app.completedRoundIds.includes(roundId)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Call only with a freshly authorized workspace. Wrap to unfinished earlier rows. */
export function nextInterviewApplicant<T extends Candidate>(applications: T[], roundId: string, currentId: string): T | null {
  const queue = interviewQueue(applications, roundId);
  const index = queue.findIndex(app => app.id === currentId);
  const ordered = [...queue.slice(index + 1), ...queue.slice(0, Math.max(0, index))];
  return ordered.find(app => app.id !== currentId && app.roundId === roundId &&
    !app.completedRoundIds.includes(roundId)) ?? null;
}
