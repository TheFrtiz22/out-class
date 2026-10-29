// Hosted voting reads re-authorize and project multiple related records.
// Keep the budget bounded without inheriting Prisma's five-second default.
export const votingReadLimits = { maxWait: 5_000, timeout: 30_000 } as const;
