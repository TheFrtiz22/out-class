// Test double for @/components/ui/confirm-dialog in server-render harnesses.
// By default confirm() answers like the stubbed window.confirm a test sets (so
// existing "cancel"/"accept" cases still drive it) and records each request.
// A test can swap in another implementation (e.g. the real controller) with use().
const requests = []
const answer = async options => {
  requests.push(options)
  const w = globalThis.window
  return typeof w?.confirm === 'function' ? !!w.confirm(options.title) : true
}
let implementation = answer
const confirm = options => implementation(options)
// Mirrors useConfirmOnce: while one confirm is open, further requests resolve false.
let open = false
const confirmOnce = async options => {
  if (open) return false
  open = true
  try { return await confirm(options) } finally { open = false }
}
module.exports = {
  useConfirm: () => confirm,
  useConfirmOnce: () => confirmOnce,
  ConfirmProvider: ({ children }) => children,
  requests,
  use(fn) { implementation = fn ?? answer; open = false },
}
