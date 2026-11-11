const { test } = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/communications-loader.cjs');
const load = loader({});
const { userMessage } = load('lib/user-message.ts');
const { ActionError, UserFacingError, actionFailure, actionSuccess, unwrapAction, unwrapped, isActionResult } = load('lib/action-result.ts');

const fallback = 'Couldn’t save your changes. Try again.';
const nextProduction = Object.assign(new Error('An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.'), { digest: '2817390912' });

test('Next production text, digests, stacks and provider internals become the fallback', () => {
  for (const error of [
    nextProduction,
    Object.assign(new UserFacingError('Saved.'), { digest: '123' }),
    new Error('This application changed in another tab.'),
    new UserFacingError('\nInvalid `prisma.application.updateMany()` invocation:\n\nUnique constraint failed on the fields: (`studentId`)'),
    new UserFacingError('PrismaClientKnownRequestError: P2002'),
    new UserFacingError('duplicate key value violates unique constraint "Application_pkey"'),
    new UserFacingError('Supabase storage upload failed: JWT expired'),
    new UserFacingError("TypeError: Cannot read properties of undefined (reading 'id')"),
    new UserFacingError('Failed\n    at persistApplication (actions/applications.ts:40:11)'),
    new UserFacingError('NEXT_REDIRECT;replace;/login;307;'),
    new UserFacingError('fetch failed'),
    new UserFacingError(''),
    new UserFacingError('x'.repeat(401)),
    { userFacing: true, message: 42 },
    'Applications are closed.',
    null, undefined, 0,
    { message: 'Looks friendly but was never marked.' },
    actionSuccess({ id: 1 }),
  ]) assert.equal(userMessage(error, fallback), fallback, String(error && error.message || error));
});

test('messages our own code marked user-facing are kept', () => {
  assert.equal(userMessage(new UserFacingError('That time was just booked. Choose another slot.'), fallback), 'That time was just booked. Choose another slot.');
  assert.equal(userMessage(actionFailure('Applications are closed for this club. Your saved draft is retained.'), fallback), 'Applications are closed for this club. Your saved draft is retained.');
  // Structured-clone or cross-realm copies keep the brand, not the prototype.
  assert.equal(userMessage({ userFacing: true, message: 'Choose a slot for your invited club and round.' }, fallback), 'Choose a slot for your invited club and round.');
  // A server-side ActionError that was thrown (not returned) never reaches the browser intact.
  assert.equal(userMessage(new ActionError('Applicant access denied.'), fallback), fallback);
});

test('unwrapAction returns data, throws a user-facing error for failures, and passes other values through', async () => {
  assert.deepEqual(unwrapAction(actionSuccess({ success: true })), { success: true });
  assert.equal(unwrapAction(undefined), undefined);
  assert.deepEqual(unwrapAction({ ok: false, error: 'not branded' }), { ok: false, error: 'not branded' });
  assert.throws(() => unwrapAction(actionFailure('Only pending offers can be revoked.', 'ACTION_REFUSED')), error => error instanceof UserFacingError && error.code === 'ACTION_REFUSED' && userMessage(error, fallback) === 'Only pending offers can be revoked.');
  const bound = unwrapped(async (value) => value === 'bad' ? actionFailure('Choose another time.') : actionSuccess(value.toUpperCase()));
  assert.equal(await bound('ok'), 'OK');
  await assert.rejects(bound('bad'), error => userMessage(error, fallback) === 'Choose another time.');
  assert.equal(isActionResult(JSON.parse(JSON.stringify(actionFailure('Serialized.')))), true);
});
