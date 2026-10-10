// Live, explicitly authorized disposable-account tests. Never prints credentials,
// passwords, OTPs, hashes, links, sessions, or provider response bodies.
const fs = require('node:fs'), { parseEnv } = require('node:util'), { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const recipient = 'bsb4rd@virginia.edu', site = 'https://www.out-class.net';
const privateDir = '/private/tmp/outclass-email-audit-private';
const publicEnv = parseEnv(fs.readFileSync(privateDir + '/production.env', 'utf8'));
const localEnv = parseEnv(fs.readFileSync('.env', 'utf8'));
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const client = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const admin = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, localEnv.SUPABASE_SECRET_KEY, options);
const ledgerFile = 'docs/email-audit/auth-send-results.json';
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : [];
function save(record) { ledger.push(record); fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2)); console.log(record); }
function providerError(error) { return { code: error.code, status: error.status }; }
(async () => {
  if (process.argv[2] !== '--disposable-account-authorized') throw Error('Explicit disposable-account test flag required.');
  const pushed = JSON.parse(fs.readFileSync(privateDir + '/subject-push.json', 'utf8'));
  if (!pushed.services?.some(s => s.service === 'auth' && s.status === 'updated' && s.changes.length === 4)) throw Error('Approved subject prefix has not been applied.');
  const command = process.argv[3] || 'send';
  if (command === 'send') {
    if (!ledger.some(x => x.type === 'magic-link')) {
      const at = new Date().toISOString();
      const { error } = await client.auth.signInWithOtp({ email: recipient, options: { shouldCreateUser: false } });
      save({ type: 'magic-link', recipient, attemptedAt: at, scope: 'actual supported Supabase signInWithOtp; shouldCreateUser:false', submission: error ? 'failed' : 'accepted by Supabase Auth', ...(error ? { error: providerError(error) } : {}), delivery: 'unconfirmed', inbox: 'not observed' });
    }
    if (!ledger.some(x => x.type === 'recovery')) {
      const at = new Date().toISOString();
      const response = await fetch(site + '/api/auth/password-recovery', { method: 'POST', headers: { origin: site, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', email: recipient }) });
      await response.arrayBuffer();
      save({ type: 'recovery', recipient, attemptedAt: at, scope: 'actual production OutClass password-recovery request route', httpStatus: response.status, submission: response.ok ? 'uniform application acknowledgment; provider acceptance requires logs' : 'failed', delivery: 'unconfirmed', inbox: 'not observed' });
    }
  } else if (command === 'password-change') {
    if (ledger.some(x => x.type === 'password-changed')) throw Error('Password-change test already attempted; no automatic retry.');
    // Generate a separate recovery token without another email. This invalidates
    // the earlier test recovery link; it remains a delivery test, not a reused token.
    const generated = await admin.auth.admin.generateLink({ type: 'recovery', email: recipient, options: { redirectTo: site + '/reset-password' } });
    if (generated.error || generated.data.user.email?.toLowerCase() !== recipient) throw Error('Disposable recipient identity check failed.');
    const tokenHash = generated.data.properties.hashed_token;
    const password = 'Audit-' + randomUUID() + '-aA1!';
    const at = new Date().toISOString();
    const response = await fetch(site + '/api/auth/password-recovery', { method: 'POST', headers: { origin: site, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset', tokenHash, password, confirmation: password }) });
    const result = await response.json();
    const success = response.ok && !result.error;
    let signInVerified = false, reuseRejected = false;
    if (success) {
      const login = await client.auth.signInWithPassword({ email: recipient, password });
      signInVerified = !login.error && login.data.user?.email?.toLowerCase() === recipient;
      await client.auth.signOut();
      const reused = await fetch(site + '/api/auth/password-recovery', { method: 'POST', headers: { origin: site, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset', tokenHash, password, confirmation: password }) });
      await reused.arrayBuffer(); reuseRejected = reused.status === 400;
    }
    save({ type: 'password-changed', recipient, attemptedAt: at, scope: 'actual production reset route with separately generated provider recovery token; earlier emailed reset token invalidated', httpStatus: response.status, resetSucceeded: success, newPasswordSignInVerified: signInVerified, recoveryTokenReuseRejected: reuseRejected, submission: success ? 'password reset succeeded; notification acceptance requires provider logs' : 'reset failed', delivery: 'unconfirmed', inbox: 'not observed' });
  } else throw Error('Unknown command.');
})().catch(() => { console.error('Live Auth audit stopped; no sensitive response content logged.'); process.exitCode = 1; });
