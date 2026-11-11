// Server Actions converted to actionResult() return { $action, ok, data | error }
// instead of throwing expected failures. Tests that assert the thrown-error
// contract wrap the loaded module so failures reject with the same message,
// exactly as lib/workspace-api.ts's unwrapAction does for the browser.
const BRAND = 'outclass.action/v1';
function unwrap(value) {
  if (!value || typeof value !== 'object' || value.$action !== BRAND) return value;
  if (value.ok) return value.data;
  throw Object.assign(new Error(value.error), { code: value.code, userFacing: true });
}
exports.unwrap = unwrap;
exports.unwrapActions = mod => new Proxy(mod, {
  get(target, key) {
    const value = target[key];
    return typeof value === 'function' ? async (...args) => unwrap(await value(...args)) : value;
  },
});
