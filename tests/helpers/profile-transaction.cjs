// Profile saves that can change the graduation year run in a transaction that locks the User row
// and applies the change through utils/graduation.ts (covered by tests/graduation.test.cjs).
// Tests of other profile rules run that transaction against their in-memory mock.
const SUPPORT_YEAR_CHANGE_MESSAGE = 'Only the account holder can change their graduation year.'
function withProfileTransaction(prisma) {
  return Object.assign(prisma, { $transaction: async fn => fn(prisma), $queryRaw: async () => [], user: { findUnique: async () => ({ disabledAt: null }), ...prisma.user } })
}
const graduation = (calls = []) => ({ SUPPORT_YEAR_CHANGE_MESSAGE, applyGraduationYearChange: async (...args) => { calls.push(args.slice(1)); return null } })
module.exports = { withProfileTransaction, graduation, SUPPORT_YEAR_CHANGE_MESSAGE }
