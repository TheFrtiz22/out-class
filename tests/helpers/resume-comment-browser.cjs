// Run against the loopback-only interview-browser-fixture.cjs server.
// Uses actual components/PDF.js, mocked Auth/DB, and a fresh browser profile.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const embedded of [false, true]) {
      for (const width of [1440, 900, 390]) {
        if (process.env.OUTCLASS_COMMENT_CASE && process.env.OUTCLASS_COMMENT_CASE !== `${embedded ? 'embedded' : 'expanded'}-${width}`) continue;
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const external = [], errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', route => {
          if (/^(http:\/\/127\.0\.0\.1:4318\/|blob:)/.test(route.request().url())) return route.continue();
          external.push(route.request().url()); return route.abort();
        });
        await page.goto(`http://127.0.0.1:4318/?mode=after${embedded ? '&embedded=1' : ''}`);
        const open = () => page.getByRole('button', { name: 'Open résumé for Fictional Applicant one', exact: true }).click();
        if (!embedded) await open();
        const field = page.getByLabel('Highlight comment', { exact: true });
        const select = async () => {
          if (width < 1024) await page.getByRole('button', { name: 'Document', exact: true }).click();
          const span = page.getByRole('document', { name: 'Selectable résumé text' }).locator('span').first();
          try { await span.waitFor(); } catch (error) {
            console.error({ embedded, width, text: await page.locator('body').innerText(), errors });
            throw error;
          }
          const bounds = await span.boundingBox();
          await page.mouse.move(bounds.x + 2, bounds.y + bounds.height / 2);
          await page.mouse.down();
          await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + bounds.height / 2, { steps: 8 });
          await page.mouse.up();
          const quote = await page.evaluate(() => getSelection().toString());
          assert.ok(quote.trim()); return quote;
        };
        for (const delay of [35, 0]) {
          const quote = await select();
          const sentence = `A complete sentence: Capital letters, spaces & punctuation! (${delay})`;
          await page.keyboard.type(sentence, { delay });
          assert.equal(await field.inputValue(), sentence);
          assert.equal(await field.evaluate(el => el === document.activeElement), true);
          const caret = await field.evaluate(el => [el.selectionStart, el.selectionEnd]);
          assert.deepEqual(caret, [sentence.length, sentence.length]);
          assert.equal(await page.locator('[data-resume-comment-draft]').count(), 1);
          assert.ok((await page.locator('[data-resume-comment-draft] blockquote').innerText()).includes(quote));
          await page.keyboard.press('Backspace'); await page.keyboard.press('Enter'); await page.keyboard.type('Second line.');
          const expected = sentence.slice(0, -1) + '\nSecond line.';
          assert.equal(await field.inputValue(), expected);
          // An actual authorization poll rerender must preserve this field/caret.
          await page.waitForTimeout(5200);
          assert.equal(await field.evaluate(el => el === document.activeElement), true);
          await page.keyboard.type(' Still typing.');
          assert.equal(await field.inputValue(), expected + ' Still typing.');
          await page.getByRole('button', { name: 'Save comment', exact: true }).click();
          await field.waitFor({ state: 'hidden' });
          await page.getByText(expected + ' Still typing.', { exact: true }).waitFor();
          if (!embedded) {
            await page.getByRole('button', { name: 'Close résumé', exact: true }).click(); await open();
            if (width < 1024) await page.getByRole('button', { name: /^Panel comments/ }).click();
            await page.getByText(expected + ' Still typing.', { exact: true }).waitFor();
          }
        }
        await select();
        await page.keyboard.press('Control+c');
        assert.equal(await field.count(), 0, 'copy must not start a composer');
        // Clipboard event exercises the selection handoff; textarea paste remains native.
        await page.evaluate(() => {
          const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', 'Pasted first, then typed.');
          document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
        });
        assert.equal(await field.inputValue(), 'Pasted first, then typed.');
        await page.keyboard.type(' Continued.');
        assert.equal(await field.inputValue(), 'Pasted first, then typed. Continued.');
        await page.getByRole('button', { name: 'Cancel comment', exact: true }).click();
        await select();
        // Chromium IME protocol, not a claim of physical OS IME testing.
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Process', windowsVirtualKeyCode: 229 });
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Process', windowsVirtualKeyCode: 229 });
        assert.equal(await field.evaluate(el => el === document.activeElement), true);
        await cdp.send('Input.imeSetComposition', { text: 'にほん', selectionStart: 3, selectionEnd: 3 });
        await cdp.send('Input.insertText', { text: '日本' });
        await page.keyboard.type(' continued');
        assert.equal(await field.inputValue(), '日本 continued');
        await page.getByRole('button', { name: 'Cancel comment', exact: true }).click();
        assert.deepEqual(external, []); assert.deepEqual(errors, []);
        console.log(`PASS ${embedded ? 'embedded' : 'expanded'} ${width}px: normal/fast typing, caret, poll, save/reopen, repeat, shortcuts, paste, IME`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
