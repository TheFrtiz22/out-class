// Drive the OutClass DatePicker in Playwright the way a person does: open it, pick a day or clear it.
const long = day => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T00:00:00Z`))
function trigger(page, label) { return page.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `) }) }
async function pickDate(page, label, day, clearLabel = 'All dates') {
  await trigger(page, label).click()
  await page.getByRole('grid').waitFor()
  if (day) {
    // Move to the target month by keyboard (Shift+PageDown/PageUp = a year, PageDown/PageUp = a month).
    const from = await page.locator('[role="grid"] button[tabindex="0"]').getAttribute('data-day')
    let months = (Number(day.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(day.slice(5, 7)) - Number(from.slice(5, 7))
    while (months) {
      const step = Math.abs(months) >= 12 ? 12 : 1
      await page.keyboard.press(`${step === 12 ? 'Shift+' : ''}${months > 0 ? 'PageDown' : 'PageUp'}`)
      months -= Math.sign(months) * step
    }
    await page.getByRole('button', { name: new RegExp(`^${long(day)}(,|$)`) }).click()
  }
  else await page.getByRole('button', { name: clearLabel, exact: true }).click()
  await page.getByRole('grid').waitFor({ state: 'detached' })
}
async function pickedDate(page, label) { return (await trigger(page, label).getAttribute('aria-label')).slice(label.length + 2) }
module.exports = { pickDate, pickedDate, long }
