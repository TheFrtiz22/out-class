const { test, before, after } = require('node:test'), assert = require('node:assert/strict')
// Fixture and helpers: tests/helpers/interview-offline-notes-fixture.cjs (real room, real IndexedDB, Chromium).
const { A, B, scope, BANNER, start, stop, room, notes, savedStatus, vault, until } = require('./helpers/interview-offline-notes-fixture.cjs')
before(start); after(stop)
test('typing offline, reloading while offline, then reconnecting saves the notes', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).fill('Saved before the drop.'); await savedStatus(page)
    await r.offline(true)
    await notes(page).fill('Saved before the drop. Typed while offline.')
    const banner = page.getByRole('status').filter({ hasText: BANNER })
    await banner.waitFor()
    assert.equal(await banner.getAttribute('aria-live'), 'polite')
    const stored = await until(async () => { const v = await vault(page); return v.records.length && v.records[0].plain?.value.additionalNotes.endsWith('offline.') && v })
    assert.equal(stored.records[0].key, `${A}:${scope.clubId}:${scope.applicationId}:${scope.roundId}`)
    assert.equal(stored.records[0].ciphertextOnly, true); assert.equal(stored.keyExtractable, false)
    assert.equal('score' in stored.records[0].plain.value, false)

    // Reload while still offline: the session cannot open, the banner and the local draft show at once.
    await page.reload()
    await page.getByRole('status').filter({ hasText: BANNER }).waitFor()
    assert.match(await page.getByRole('textbox', { name: 'Your unsaved notes on this device (read-only)' }).inputValue(), /Typed while offline\./)
    assert.equal(r.server.record.draft.additionalNotes, 'Saved before the drop.')

    // Reconnect: the session reopens, the copy is restored and saved through the revision check.
    await r.offline(false)
    await until(() => r.server.record.draft.additionalNotes === 'Saved before the drop. Typed while offline.')
    await savedStatus(page)
    assert.equal(await notes(page).inputValue(), 'Saved before the drop. Typed while offline.')
    assert.equal(r.server.saves.at(-1).revision, 1)
    await until(async () => (await vault(page)).records.length === 0)
    assert.equal(await page.getByText(BANNER).count(), 0)

    // Offline again, then a reload once back online: restored and saved automatically.
    await r.offline(true)
    await notes(page).fill('Second offline edit.')
    await until(async () => (await vault(page)).records[0]?.plain?.value.additionalNotes === 'Second offline edit.')
    await page.close(); await r.offline(false)
    page = await r.open()
    await until(() => r.server.record.draft.additionalNotes === 'Second offline edit.')
    await savedStatus(page)
    await until(async () => (await vault(page)).records.length === 0)
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('a conflict on reconnect shows the existing conflict choice and overwrites nothing', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).fill('Base.'); await savedStatus(page)
    await r.offline(true)
    await notes(page).fill('Base. Mine, typed offline.')
    await until(async () => (await vault(page)).records[0]?.plain?.value.additionalNotes === 'Base. Mine, typed offline.')
    // Another device saves meanwhile.
    r.server.record = { ...r.server.record, revision: r.server.record.revision + 1, draft: { ...r.server.record.draft, additionalNotes: 'Base. From another device.' } }

    // Reconnect in the same page: the revision check rejects the save and the existing choice appears.
    await r.offline(false)
    await page.getByRole('button', { name: 'Load latest version, keep my text', exact: true }).waitFor()
    assert.equal(r.server.record.draft.additionalNotes, 'Base. From another device.')
    assert.equal(await notes(page).inputValue(), 'Base. Mine, typed offline.')
    assert.equal((await vault(page)).records[0].plain.value.additionalNotes, 'Base. Mine, typed offline.')

    // Reload: the device copy is older than the server, so the conflict choice shows; nothing is applied or saved.
    const savesBefore = r.server.saves.length
    await page.close(); page = await r.open()
    await page.getByText('This device has changes from before a newer version was saved elsewhere.').waitFor()
    assert.equal(await notes(page).inputValue(), 'Base. From another device.')
    assert.equal(await notes(page).isDisabled(), true)
    await page.getByRole('button', { name: 'Review my copy', exact: true }).click()
    assert.match(await page.getByRole('textbox', { name: 'Your earlier copy (read-only)' }).inputValue(), /Mine, typed offline\./)
    await new Promise(res => setTimeout(res, 1200))
    assert.equal(r.server.saves.length, savesBefore); assert.equal(r.server.record.draft.additionalNotes, 'Base. From another device.')
    assert.equal((await vault(page)).records.length, 1)
    // Only the interviewer's explicit "Keep newer version" deletes the device copy.
    await page.getByRole('button', { name: 'Keep newer version', exact: true }).click()
    await until(async () => (await vault(page)).records.length === 0)
    assert.equal(await notes(page).isDisabled(), false)
    assert.equal(r.server.record.draft.additionalNotes, 'Base. From another device.')
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('sign-out clears the local copy and its key; another account gets nothing and the stale entry is deleted', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).waitFor(); await r.offline(true)
    await notes(page).fill('Private notes of account A.')
    await until(async () => (await vault(page)).records.length === 1)
    await page.getByRole('button', { name: 'Fixture sign out' }).click()
    await page.waitForSelector('body[data-signed-out="true"]')
    const cleared = await vault(page)
    assert.deepEqual(cleared.records, []); assert.equal(cleared.exists, false)   // database (and key) deleted
    await page.close()

    // Account A leaves a copy; account B opens the same interview in this browser.
    await r.offline(false); page = await r.open(A); await notes(page).waitFor(); await r.offline(true)
    await notes(page).fill('Account A again, offline.')
    await until(async () => (await vault(page)).records.length === 1)
    await page.close(); await r.offline(false)
    page = await r.open(B)
    await savedStatus(page)
    assert.equal(await notes(page).inputValue(), '')
    await until(async () => (await vault(page)).records.length === 0)
    assert.equal(r.server.saves.length, 0)
    assert.equal(await page.getByText('This device has changes', { exact: false }).count(), 0)
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})

test('submitted evaluations, scores, Demo Mode and support sessions are never stored on the device', async () => {
  const r = await room()
  try {
    let page = await r.open()
    await notes(page).fill('Final notes.'); await savedStatus(page)
    await page.getByRole('button', { name: 'End current interview', exact: true }).click()
    await page.getByRole('heading', { name: 'Post-interview' }).waitFor()
    await r.offline(true)
    await page.getByRole('slider').press('End')
    await notes(page).fill('Final notes. Last thought offline.')
    const copy = await until(async () => (await vault(page)).records[0]?.plain)
    assert.equal('score' in copy.value, false); assert.equal(copy.value.postInterview, true)
    await r.offline(false)
    await until(() => r.server.record.draft.additionalNotes === 'Final notes. Last thought offline.' && r.server.record.draft.score === 10)
    await page.getByRole('button', { name: 'End post-interview', exact: true }).click()
    await page.waitForSelector('body[data-submitted="true"]')
    await until(async () => (await vault(page)).records.length === 0)
    assert.ok(r.server.record.completedAt)
    await page.close()
    // Reopening a submitted interview offline-and-back never writes a copy.
    page = await r.open()
    await page.getByText('Submitted · Read only').waitFor()
    await r.offline(true); await new Promise(res => setTimeout(res, 300))
    assert.equal((await vault(page)).records.length, 0)
    assert.equal(await page.getByText(BANNER).count(), 0)
    await r.offline(false); await page.close()

    // Demo Mode and support sessions keep the tab-only behavior: no IndexedDB database at all.
    for (const query of ['&demo', '&support']) {
      const fresh = await room()
      try {
        const p = await fresh.open(A, query)
        await notes(p).fill('Demo typing.'); await savedStatus(p)
        await fresh.offline(true)
        await notes(p).fill('Demo typing offline.')
        await p.getByText('Offline · notes kept in this tab').or(p.getByText('Saving…')).first().waitFor()
        await new Promise(res => setTimeout(res, 300))
        assert.equal((await vault(p)).exists, false, query)
        assert.equal(await p.getByText(BANNER).count(), 0)
      } finally { await fresh.context.close() }
    }
    assert.deepEqual(r.errors, [])
  } finally { await r.context.close() }
})
