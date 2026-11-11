// Test double for @/components/ui/confirm-dialog in server-render harnesses.
// confirm() answers like the stubbed window.confirm a test sets (so existing
// "cancel"/"accept" cases still drive it) and records each request's options.
const requests = []
const answer = options => {
  requests.push(options)
  const w = globalThis.window
  return typeof w?.confirm === 'function' ? !!w.confirm(options.title) : true
}
const confirm = async options => answer(options)
module.exports = { useConfirm: () => confirm, ConfirmProvider: ({ children }) => children, requests }
