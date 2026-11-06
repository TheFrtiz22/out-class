// Choose a "YYYY-MM-DD" day in components/ui/date-picker through its real popover,
// using the calendar keyboard (Shift+Page keys by year, Page keys by month, arrows by day).
async function pickDate(page, label, day) {
  // The trigger's name is "<label>, <shown value>" so it always contains its visible text.
  await page.getByRole('button', { name: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ',') }).click()
  await page.getByRole('grid').waitFor()
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('data-day'))
  const months = key => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7))
  for (let i = 0; i < 400; i++) {
    const at = await focused()
    if (!at) throw new Error('Date picker grid did not take focus')
    if (at === day) break
    const gap = months(day) - months(at)
    if (Math.abs(gap) >= 12) await page.keyboard.press(gap > 0 ? 'Shift+PageDown' : 'Shift+PageUp')
    else if (gap) await page.keyboard.press(gap > 0 ? 'PageDown' : 'PageUp')
    else await page.keyboard.press(day > at ? 'ArrowRight' : 'ArrowLeft')
  }
  if (await focused() !== day) throw new Error(`Date picker could not reach ${day}`)
  await page.keyboard.press('Enter')
  await page.getByRole('grid').waitFor({ state: 'detached' })
}
module.exports = { pickDate }
