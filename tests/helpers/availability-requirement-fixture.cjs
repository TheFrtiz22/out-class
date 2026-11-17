// Signed-in browser fixtures pass the required weekly-availability step (components/availability/availability-gate.tsx)
// without changing anyone's schedule: they record the same "no regular free time" choice the step stores
// (lib/availability-requirement.ts NO_REGULAR_AVAILABILITY_ACTION). tests/availability-requirement.test.cjs
// keeps this action name in step with the app.
const NO_REGULAR_AVAILABILITY_ACTION = 'availability.requirement.declare_none'
async function satisfyAvailabilityRequirement(db, ...userIds) {
  const ids = [...new Set(userIds.flat().filter(Boolean))]
  if (ids.length) await db.auditLog.createMany({ data: ids.map(id => ({ actorId: id, targetId: id, action: NO_REGULAR_AVAILABILITY_ACTION })) })
}
module.exports = { NO_REGULAR_AVAILABILITY_ACTION, satisfyAvailabilityRequirement }
