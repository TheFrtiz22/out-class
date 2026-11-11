// Server Actions converted to actionResult() return
// { $action, ok: true, data } or { $action, ok: false, error, code }
// instead of throwing expected failures. Tests read them through these helpers:
// - unwrap(value): the data of a success; a failure throws a refusal error
//   carrying `refused: true` and the result's `code` (the browser equivalent is
//   lib/action-result.ts unwrapAction). Unbranded values pass through.
// - unwrapActions(module): the same for every exported function.
// - refused(promise, pattern?): asserts the call returned { ok: false, code }
//   (directly or through unwrap), not a thrown error, and checks the message.
const assert = require('node:assert/strict');
const BRAND = 'outclass.action/v1';
function unwrap(value) {
  if (!value || typeof value !== 'object' || value.$action !== BRAND) return value;
  if (value.ok) return value.data;
  throw Object.assign(new Error(value.error), { code: value.code, refused: true, userFacing: true, result: value });
}
async function refused(promise, pattern) {
  let outcome;
  try { outcome = await promise; } catch (error) {
    assert.ok(error && error.refused === true, `expected a returned { ok: false } refusal, got a thrown error: ${error && error.message}`);
    outcome = error.result;
  }
  assert.ok(outcome && outcome.$action === BRAND && outcome.ok === false, 'expected an { ok: false } action result');
  assert.equal(typeof outcome.code, 'string');
  if (pattern) assert.match(outcome.error, pattern);
  return outcome;
}
exports.unwrap = unwrap;
exports.refused = refused;
exports.unwrapActions = mod => new Proxy(mod, {
  get(target, key) {
    const value = target[key];
    return typeof value === 'function' ? async (...args) => unwrap(await value(...args)) : value;
  },
});
