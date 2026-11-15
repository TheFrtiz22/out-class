// Answer the next OutClass confirm (components/ui/confirm-dialog.tsx, an AlertDialog) the way page.once('dialog')
// answered window.confirm: arm it before the click that asks. The footer is Cancel then the action (whose variant
// depends on tone), so accept clicks the last button and dismiss the first. A confirm that never appears is ignored.
module.exports = function confirmNext(page, accept = true) {
  const footer = page.locator('[data-slot="alert-dialog-content"] [data-slot="alert-dialog-footer"]')
  footer.waitFor({ timeout: 15000 })
    .then(() => (accept ? footer.locator('button').last() : footer.locator('button').first()).click())
    .catch(() => {})
}
