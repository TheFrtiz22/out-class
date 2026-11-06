// Drive the OutClass DatePicker in Playwright the way a person does: open it, pick a day or clear it.
const long = day => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T00:00:00Z`))
function trigger(page, label) { return page.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `) }) }
async function pickDate(page, label, day, clearLabel = 'All dates') {
  await trigger(page, label).click()
  await page.getByRole('grid').waitFor()
  if (day) await page.getByRole('button', { name: new RegExp(`^${long(day)}(,|$)`) }).click()
  else await page.getByRole('button', { name: clearLabel, exact: true }).click()
  await page.getByRole('grid').waitFor({ state: 'detached' })
}
async function pickedDate(page, label) { return (await trigger(page, label).getAttribute('aria-label')).slice(label.length + 2) }
module.exports = { pickDate, pickedDate, long }
