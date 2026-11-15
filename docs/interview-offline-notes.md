# Interview-room notes offline

Unsaved interview-room notes survive a dropped connection and a page reload. The server remains the only source of truth: the device copy holds only notes the server has not acknowledged, and it is deleted as soon as the server confirms them.

Code: `lib/interview-offline-notes.ts` (storage, encryption, expiry), `hooks/use-interview-offline-notes.ts` (room lifecycle), wired into `components/interview-kit-session.tsx`. Tests: `tests/interview-offline-notes.test.cjs`, `tests/interview-offline-notes-browser.test.cjs`, `tests/interview-offline-notes-resilience-browser.test.cjs`.

## Privacy

**What is stored on the device.** Only the signed-in interviewer's own unsaved draft for one interview: per-question notes, their own added questions and notes, miscellaneous notes, final interview thoughts, and which questions they marked complete, plus the interview's session id, the server revision and a fingerprint of the server's notes when the copy was made (used to detect conflicts). Never stored: scores (the overall score and any rubric scores), submitted evaluations, other interviewers' notes, shared room content (the room's selected question, participants, timer, invitations), the question bank or answer keys, applicant profiles or résumés. Nothing is stored in Demo Mode, during a support (impersonation) session, without a signed-in account, or for anonymous rounds (they never open an interview room).

**Where.** IndexedDB database `outclass-offline` on the OutClass origin:
- object store `interview-notes`: at most one record per unsaved interview;
- object store `device-keys`: one encryption key for this browser profile (id `interview-notes-v1`).

Fallback: when a device write fails (private mode, quota, storage error), when an existing device copy cannot be opened, or while another tab's write has replaced this tab's copy, the same notes are kept in this tab's sessionStorage (key `outclass:autosave:v2:<user id>:interview-notes:<club>:<application>:<round>`), as before this feature, until a device write succeeds. The status then says "notes kept in this tab", never "on this device".

No localStorage is used for notes, and nothing is written to the service worker cache.

**How it is keyed.** `<user id>:<club id>:<application id>:<round id>`. Notes are per interviewer, application and round (not per room). The readable part of a record is only that key, the owner's user id, the time it was written, the writing tab's random id and the server revision; the notes are ciphertext. Every read checks the signed-in user: a record belonging to any other account is not returned and is deleted. A record that cannot be opened (missing key, failed decryption, storage error) is never returned, never deleted silently and never overwritten: the room says "A saved copy on this device couldn't be opened" and keeps notes in the tab instead.

**How it is encrypted.** AES-GCM, 256-bit, with a fresh random 96-bit IV for every write, using Web Crypto. The key is generated in the browser as non-extractable (page code can encrypt and decrypt with it but can never read or export its bytes) and is stored in `device-keys`. The record key is the AES-GCM additional data, so a record moved under another user or interview fails to decrypt and is never returned. This protects the notes at rest from casual inspection of browser storage and binds each copy to its owner and interview; it is not a defence against someone who controls the signed-in browser profile itself.

**When it is deleted.**
- As soon as the server confirms a save that contains the notes (the room's existing autosave and revision check), and when this tab submits the evaluation. A tab deletes only a copy it wrote itself; another tab's newer unsaved copy survives, and that tab puts its notes back on the device.
- When the interviewer chooses "Keep newer version" after a conflict. If the interview was submitted elsewhere, or the session record changed, while this tab still held unsaved text, the copy is kept and offered through that conflict choice when the interview is reopened.
- On sign-out (account menu, and the account-unavailable screen): sign-out asks before discarding any unsaved copy this account has on the device (including ones left by earlier pages), then the device key and the whole `outclass-offline` database are deleted, and the page refuses later writes. Other open tabs are sealed too when they hear the sign-out.
- On the next signed-in load in this browser: after an explicit sign-out (the shared owner marker is gone), every device copy is deleted, so a sign-out that timed out leaves nothing behind; otherwise copies left by any other account are deleted.
- When it expires (below).

**Maximum lifetime.** 7 days from the last write. Expired copies are purged on every signed-in page load and are never returned by a read. If an interviewer never returns and never signs in again in that browser, the ciphertext can remain on disk until the browser clears site data, but it is never read after 7 days and is deleted on the next signed-in load.

## Behavior

- **Offline.** While the browser is offline and unsaved notes are on this device, the room shows "You're offline. Your notes are kept on this device and will save when you reconnect." (role `status`, polite), using the existing autosave status style. The save indicator reads "Offline · notes kept on this device".
- **Reconnect.** The room's existing reconnect flush saves the notes with the current revision. If another device or tab saved meanwhile, the server rejects the stale revision and the existing choice appears ("Retry save" / "Load latest version, keep my text"); nothing is overwritten, and the device copy stays until the server accepts the notes.
- **Writes.** Device writes wait for a 300 ms pause in typing and happen at once on blur, going offline, page hide and leaving the room.
- **Reload while online.** The newest of the device copy and this tab's fallback copy is considered. If the server is exactly where the copy left it (same session, revision and notes), the copy is restored into the editor and the existing autosave saves it. If the server changed meanwhile, the existing conflict choice appears ("Keep newer version" / "Review my copy", read-only); editing and submission are blocked until the interviewer chooses, and neither side is overwritten.
- **Reload while offline.** If the app loads but the interview cannot be opened, the banner and a read-only view of the device copy show immediately; on reconnect the interview reopens and the copy is restored as above. Note: a full browser reload with no network at all is served `/offline.html` by the service worker, which deliberately never caches page HTML (`docs/service-worker.md`); the copy is kept and restored once the room loads again.
- **Signed-in account.** Once known, the account is kept for the page, so a transient auth failure (the user briefly unknown) never switches storage or stops the device copy.
- **Demo Mode** and support sessions keep the previous tab-only behavior (memory plus this tab's sessionStorage) and never opens the database.

## Relation to the shared autosave (#275)

#275 added device copies for editors of the user's own data (localStorage) and deliberately kept interview notes tab-only (sessionStorage), because the notes are private assessments of another student. This feature does not add a second autosave system: it reuses #275's recovery lifecycle (`useAutosaveRecovery`: reconnect and visibility flush, unload guard, navigation flush), its connection detection (`connectionProblem`, `browserOnline`), its status and conflict component (`AutosaveStatus`), its sign-out flow (`prepareSignOut` / `sealAutosaveDraftsForSignOut`) and its account-switch hook (`adoptAutosaveOwner`), and its 7-day expiry. It replaces only the interview room's storage backend, because the notes need to outlive the tab: localStorage would keep plaintext notes about an applicant with no expiry enforcement outside page code, so the copy is encrypted in IndexedDB instead. #275's only localStorage entry that touches this feature is its existing owner marker (`outclass:autosave:owner`, a user id, no content).
