// Native account creation (mobile/src/app/sign-up.tsx, complete-profile.tsx): the app reuses the
// web's own sign-up steps through public mobile operations. These checks pin what those operations
// may and may not do; the steps themselves are tested with the web flow (email-confirmation, onboarding).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const operations = read('lib/mobile-api/operations.ts')
const auth = read('lib/mobile-api/auth.ts')
const shared = read('lib/email-code-session.ts')

test('only the three sign-up steps and the emailed password reset are public auth operations; terms.accept needs a session', () => {
  const publicOps = [...operations.matchAll(/^\s*"([\w.]+)": operation\(.*\{ public: true \}\),?$/gm)].map(match => match[1]).filter(name => name.startsWith('auth.') || name.startsWith('terms.'))
  assert.deepEqual(publicOps.sort(), ['auth.confirmEmail', 'auth.register', 'auth.resetPassword', 'auth.signupOptions'])
  assert.match(operations, /"terms\.accept": operation\("POST", none, async \(\) => \(await import\("@\/lib\/mobile-api\/auth"\)\)\.mobileAcceptTerms\(\)\),/)
})

test('register runs the web action unchanged and never says whether the email already has an account', () => {
  assert.match(auth, /registerStudent\(account, turnstileToken, \{ acceptTerms: acceptTerms === true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION \}\)/)
  assert.match(auth, /if \("error" in result && typeof result\.error === "string"\) throw new ActionError\(result\.error, "SIGNUP_REFUSED"\);\n  return \{ codeSent: true as const \};/)
  assert.doesNotMatch(auth, /authenticated/)
})

test('confirming a code is rate limited per address before any Auth call, and keeps the web route checks', () => {
  const body = auth.slice(auth.indexOf('export async function mobileConfirmEmail'))
  assert.ok(body.indexOf('rateLimiter.check(RATE_LIMITS.emailCode') < body.indexOf('verifyEmailCode('), 'burst limit first')
  assert.match(auth, /email: z\.string\(\)\.trim\(\)\.toLowerCase\(\)\.email\(\)\.max\(320\)\.refine\(isUvaEmail\)/)
  assert.match(auth, /code: z\.string\(\)\.regex\(\/\^\\d\{6\}\$\/\)/)
  // Only a password that passes the policy may be saved with the code, as on the web.
  assert.match(auth, /registrationSchema\.shape\.password\.safeParse\(input\.password\)\.success \? input\.password : undefined/)
  // The durable per-email limit, then Auth, then the verified-account hardening, in one shared place.
  assert.ok(shared.indexOf('recordEmailCodeAttempt(') < shared.indexOf('verifyOtp('))
  assert.ok(shared.indexOf('verifyOtp(') < shared.indexOf('secureVerifiedAccount('))
  assert.match(shared, /if \(!passwordAlreadySecured\(user\)\)/)
  // The web route and the app share the helper, so the two cannot drift.
  assert.match(read('app/api/auth/confirm-email/route.ts'), /await verifyEmailCode\(\{ email, code, password, clientIp: clientAddress\(request\) \}\)/)
})

test('the session goes only to the caller that proved the code; the options are public values', () => {
  assert.match(auth, /return \{ session: verified\.session, passwordSaved: /)
  assert.match(shared, /return \{ ok: true, session: \{ access_token: session\.access_token, refresh_token: session\.refresh_token \}/)
  const options = auth.slice(auth.indexOf('export function mobileSignupOptions'), auth.indexOf('export const mobileRegisterInput'))
  assert.deepEqual([...options.matchAll(/^\s{4}(\w+):/gm)].map(match => match[1]), ['termsRequired', 'turnstileSiteKey', 'graduationYears'])
})

test('the app holds a signed-in account without a profile on complete-profile', () => {
  const layout = read('mobile/src/app/_layout.tsx')
  assert.match(layout, /const needsProfile = !!session && me\.data\?\.profile === null;/)
  assert.match(layout, /else if \(needsProfile\) \{ if \(!onProfile\) router\.replace\("\/complete-profile"\); \}/)
  assert.match(layout, /segments\[0\] === "sign-in" \|\| segments\[0\] === "sign-up"/)
  const signup = read('mobile/src/lib/signup.ts')
  // The client email check is the server's own pattern.
  assert.ok(signup.includes('/^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\\.edu$/i'))
  assert.ok(read('lib/auth.ts').includes('/^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\\.edu$/i'))
  const screen = read('mobile/src/app/sign-up.tsx')
  assert.match(screen, /api\.post\("auth\.register", .*\{ anonymous: true \}\)/)
  assert.match(screen, /supabase\.auth\.setSession\(result\.session\)/)
  assert.match(read('mobile/src/app/complete-profile.tsx'), /api\.post\("profile\.create", /)
})
