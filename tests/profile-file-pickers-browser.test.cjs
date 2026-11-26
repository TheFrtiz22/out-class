// Edit profile's photo and résumé fields use OutClass buttons, not the browser's "Choose File · No file chosen"
// control (seen live at 375px). Each button opens the same labelled file input. Isolated student-screens fixture.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { chromium } = require('playwright')
const { startStudentScreens } = require('./helpers/student-screens-fixture.cjs')

test('browser: Edit profile file fields are buttons that open the file picker', { timeout: 300000 }, async t => {
  const fixture = await startStudentScreens(); t.after(() => fixture.close())
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
  await page.goto(fixture.url('page=profile')); await page.getByRole('button', { name: /Edit profile/ }).first().click()
  const dialog = page.getByRole('dialog'); await dialog.waitFor()
  const visibleNativeFile = () => dialog.locator('input[type=file]').evaluateAll(inputs => inputs.filter(i => { const r = i.getBoundingClientRect(); return r.width > 2 && r.height > 2 }).length)
  assert.equal(await visibleNativeFile(), 0, 'no native file control on Name & photo')
  assert.equal(await dialog.getByLabel(/Profile photo/).count(), 1, 'the file input keeps its label')
  const [photo] = await Promise.all([page.waitForEvent('filechooser'), dialog.getByRole('button', { name: /^(Choose|Replace) photo$/ }).click()])
  assert.equal(photo.isMultiple(), false)
  await dialog.getByRole('radio', { name: 'Links & résumé' }).or(dialog.getByRole('tab', { name: 'Links & résumé' })).or(dialog.getByRole('button', { name: 'Links & résumé' })).first().click()
  assert.equal(await visibleNativeFile(), 0, 'no native file control on Links & résumé')
  const [resume] = await Promise.all([page.waitForEvent('filechooser'), dialog.getByRole('button', { name: 'Upload résumé' }).click()])
  assert.equal(resume.isMultiple(), false)
})
