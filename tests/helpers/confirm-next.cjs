// Answer the next OutClass confirm (components/ui/confirm-dialog.tsx, an AlertDialog) the way page.once('dialog')
// answered window.confirm: arm it before the click that asks. A confirm that never appears is ignored.
module.exports = function confirmNext(page, accept = true) {
  const footer = page.locator('[data-slot="alert-dialog-content"] [data-slot="alert-dialog-footer"]')
  footer.waitFor({ timeout: 15000 })
    .then(() => footer.locator(accept ? '[data-variant="default"]' : '[data-variant="outline"]').click())
    .catch(() => {})
}
