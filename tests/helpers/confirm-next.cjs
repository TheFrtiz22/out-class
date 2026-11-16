// Answer the next OutClass confirm (components/ui/confirm-dialog.tsx, an AlertDialog) the way page.once('dialog')
// answered window.confirm: arm it before the click that asks. Unlike window.confirm, the in-app dialog opens after
// the click returns, so a test may arm the next answer before this one's dialog appears: answers are used in the
// order they were armed, and each dialog is claimed by exactly one of them (marked in the page, so a later answer
// that sees the same dialog before it closes waits for the next one instead). Answers expire after 15s if nothing
// asks. Only an open dialog counts (an answered one animates closed in the DOM). The footer is Cancel then the
// action (its variant depends on tone): accept clicks the last button, dismiss the first. The promise settles once
// the dialog has fully gone (a modal hides the page from role queries while it is open).
const queues = new WeakMap()
module.exports = function confirmNext(page, accept = true) {
  const queue = queues.get(page) ?? []
  queues.set(page, queue)
  const me = {}
  queue.push(me)
  const any = page.locator('[data-slot="alert-dialog-content"]')
  const open = page.locator('[data-slot="alert-dialog-content"][data-state="open"]:not([data-confirm-next-claimed])')
  const footer = open.locator('[data-slot="alert-dialog-footer"]')
  const deadline = Date.now() + 15000
  const left = () => Math.max(1, deadline - Date.now())
  return (async () => {
    try {
      for (;;) {
        await footer.first().waitFor({ timeout: left() })
        if (queue[0] !== me) { await open.first().waitFor({ state: 'detached', timeout: left() }); continue }
        // Claim this dialog in the page (atomic there); if another answer already took it, wait for the next one.
        const claimed = await open.first().evaluate(el => {
          if (el.hasAttribute('data-confirm-next-claimed')) return false
          el.setAttribute('data-confirm-next-claimed', '')
          return true
        }).catch(() => false)
        if (!claimed) continue
        queue.shift()
        const buttons = page.locator('[data-slot="alert-dialog-content"][data-state="open"][data-confirm-next-claimed] [data-slot="alert-dialog-footer"] button')
        await (accept ? buttons.last() : buttons.first()).click()
        await any.waitFor({ state: 'detached', timeout: 5000 })
        return
      }
    } catch { /* nothing asked in time */ } finally {
      const i = queue.indexOf(me)
      if (i >= 0) queue.splice(i, 1)
    }
  })()
}
