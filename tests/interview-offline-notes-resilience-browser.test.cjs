const { test, before, after } = require('node:test'), assert = require('node:assert/strict')
// Failure paths of interview offline notes in Chromium with real IndexedDB, BroadcastChannel and
// sessionStorage. Fixture: tests/helpers/interview-offline-notes-fixture.cjs.
const { A, start, stop, room, notes, savedStatus, vault, until } = require('./helpers/interview-offline-notes-fixture.cjs')
before(start); after(stop)
const tabCopy = page => page.evaluate(() => { const key = Object.keys(sessionStorage).find(k => k.includes(':interview-notes:')); return key ? JSON.parse(sessionStorage.getItem(key)).value.additionalNotes : null })
const statusText = page => page.locator('.oc-room-save [role="status"]').textContent()

test('a transient auth failure (user briefly null) never stops the device copy; the newest text is restored', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).fill('Before.'); await savedStatus(page)
    r.server.blockSaves = true
    await notes(page).fill('Before. One.')
    await until(async () => (await vault(page)).records[0]?.plain?.value.additionalNotes === 'Before. One.')
    // /api/users/me failed: the auth context reports no user for a while.
    await page.evaluate(() => { window.__user = null; dispatchEvent(new Event('fixture-auth')) })
    await notes(page).fill('Before. One. Two, typed while auth was failing.')
    await until(async () => (await vault(page)).records[0]?.plain?.value.additionalNotes === 'Before. One. Two, typed while auth was failing.')
    assert.equal(await tabCopy(page), null)
    // Remount (reload) with auth back: the newest text is restored and saved.
    r.server.blockSaves = false
    await page.reload()
    await until(() => r.server.record.draft.additionalNotes === 'Before. One. Two, typed while auth was failing.')
    await savedStatus(page)
    assert.equal(await notes(page).inputValue(), 'Before. One. Two, typed while auth was failing.')
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('two tabs: one tab\'s confirmed save keeps (and restores) the other tab\'s newer unsaved copy, with honest status', async () => {
  const r = await room()
  try {
    const a = await r.open(), b = await r.open()
    await notes(a).waitFor(); await notes(b).waitFor()
    // Tab B cannot reach OutClass; its notes are on the device.
    await b.route('**/api/save', route => route.abort('internetdisconnected'))
    await notes(b).fill('Tab B, unsaved and newer.')
    await b.getByText('Couldn’t reach OutClass · notes kept on this device').waitFor()
    await until(async () => (await vault(b)).records[0]?.plain?.value.additionalNotes === 'Tab B, unsaved and newer.')
    // Tab A writes and saves: its write displaces B's device copy (B keeps it in its tab), its save
    // deletes only its own copy, and B puts its notes back on the device.
    await notes(a).fill('Tab A text.')
    await until(() => r.server.record.draft.additionalNotes === 'Tab A text.')
    await until(async () => (await vault(b)).records[0]?.plain?.value.additionalNotes === 'Tab B, unsaved and newer.', 8000)
    await until(async () => (await statusText(b)) === 'Couldn’t reach OutClass · notes kept on this device')
    assert.equal(await notes(b).inputValue(), 'Tab B, unsaved and newer.')
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('IndexedDB writes failing (private mode, quota) fall back to the tab copy, never claim "on this device", and restore after reload', async () => {
  const r = await room()
  try {
    const page = await r.open(A, '&noidb')
    await notes(page).fill('Saved.'); await savedStatus(page)
    r.server.blockSaves = true
    await notes(page).fill('Saved. Kept only in this tab.')
    await until(async () => (await tabCopy(page)) === 'Saved. Kept only in this tab.')
    await page.getByText('Couldn’t reach OutClass · notes kept in this tab').waitFor()
    assert.equal(await page.getByText('notes kept on this device').count(), 0)
    assert.equal((await vault(page)).records.length, 0)
    r.server.blockSaves = false
    await page.reload()
    await until(() => r.server.record.draft.additionalNotes === 'Saved. Kept only in this tab.')
    await savedStatus(page)
    await until(async () => (await tabCopy(page)) === null)
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('submitted elsewhere: the unsaved text stays on the device until the interviewer dismisses it', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).fill('Mine.'); await savedStatus(page)
    r.server.blockSaves = true
    await notes(page).fill('Mine. Unsaved when another device submitted.')
    await until(async () => (await vault(page)).records[0]?.plain?.value.additionalNotes === 'Mine. Unsaved when another device submitted.')
    r.server.record = { ...r.server.record, revision: r.server.record.revision + 1, completedAt: new Date().toISOString(), draft: { ...r.server.record.draft, additionalNotes: 'Submitted elsewhere.', score: 8 } }
    r.server.blockSaves = false
    // Leaving the notes field flushes (existing focusout save, rejected as completed); then load the latest.
    await notes(page).blur()
    await page.getByText(/Your interview could not be saved/).waitFor()
    await page.getByRole('button', { name: 'Load latest version, keep my text', exact: true }).click()
    // The room is now the submitted, read-only review. (Its alert text can be replaced by a focusout save
    // that the disabled button triggers while refreshing: an existing race, reported separately.)
    await page.getByText('Submitted · Read only').waitFor()
    assert.equal(await notes(page).inputValue(), 'Mine. Unsaved when another device submitted.')
    await new Promise(res => setTimeout(res, 800))
    assert.equal((await vault(page)).records[0]?.plain?.value.additionalNotes, 'Mine. Unsaved when another device submitted.')
    // Reopening offers the kept text through the existing conflict choice; only dismissing deletes it.
    await page.close(); page = await r.open()
    await page.getByText('This device has changes from before a newer version was saved elsewhere.').waitFor()
    await page.getByRole('button', { name: 'Review my copy', exact: true }).click()
    assert.match(await page.getByRole('textbox', { name: 'Your earlier copy (read-only)' }).inputValue(), /Unsaved when another device submitted/)
    assert.equal((await vault(page)).records.length, 1)
    await page.getByRole('button', { name: 'Keep newer version', exact: true }).click()
    await until(async () => (await vault(page)).records.length === 0)
    assert.equal(r.server.record.draft.additionalNotes, 'Submitted elsewhere.')
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})
