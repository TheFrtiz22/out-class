const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
function load(file, mocks = {}) { const mod = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports); return mod.exports; }
test('claim email escapes names, binds the fragment to the supported route and rejects unsafe URLs/tokens', () => {
  const { studentClaimEmail } = load('lib/student-claim-email.ts');
  const input = { name: '<script>alert(1)</script>\r\nBcc: test', tokenHash: 'a'.repeat(64), siteUrl: 'https://www.out-class.net/ignored' };
  const email = studentClaimEmail(input);
  assert.ok(email.html.includes('&lt;script&gt;')); assert.ok(!email.html.includes('<script>'));
  assert.ok(email.html.includes('/auth/student-claim#token_hash=' + input.tokenHash));
  assert.ok(email.text.includes('/auth/student-claim#token_hash=' + input.tokenHash));
  assert.ok(!email.html.includes('/ignored')); assert.ok(!email.text.includes('\r'));
  for (const siteUrl of ['http://evil.test', 'https://user:password@www.out-class.net', 'javascript:alert(1)']) assert.throws(() => studentClaimEmail({ ...input, siteUrl }));
  for (const tokenHash of ['short', 'a'.repeat(64) + '&email=other', 'x'.repeat(513)]) assert.throws(() => studentClaimEmail({ ...input, tokenHash }));
});
test('claim SMTP sends both MIME alternatives and returns its receipt without exposing the token in metadata', async () => {
  const vars = { SMTP_HOST: 'smtp.existing.test', SMTP_PORT: '465', SMTP_USER: 'existing', SMTP_PASSWORD: 'fixture', SMTP_FROM_EMAIL: 'no-reply@updates.out-class.net', OUTCLASS_SITE_URL: 'https://www.out-class.net' };
  const previous = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]])); Object.assign(process.env, vars);
  let message, options, closed = false;
  try {
    const { sendStudentClaimEmail } = load('utils/email.ts', { nodemailer: { createTransport: o => { options = o; return { sendMail: async m => { message = m; return { accepted: ['bsb4rd@virginia.edu'], messageId: m.messageId }; }, close: () => { closed = true; } }; } } });
    const receipt = await sendStudentClaimEmail({ recipient: 'bsb4rd@virginia.edu', name: 'Taylor', tokenHash: 'a'.repeat(64), deliveryId: 'audit-fixture', siteUrl: vars.OUTCLASS_SITE_URL });
    assert.equal(options.secure, true); assert.equal(options.greetingTimeout, 5000); assert.equal(closed, true);
    assert.equal(message.to, 'bsb4rd@virginia.edu'); assert.ok(message.html); assert.ok(message.text); assert.deepEqual(receipt, { messageId: '<audit-fixture@www.out-class.net>' });
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
