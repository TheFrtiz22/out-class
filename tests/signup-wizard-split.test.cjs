// FE-4: the sign-up wizard's step 1 (visible first, server-rendered) does not ship the step 2 code
// input or the step 3 Radix select; those load as their own chunks, warmed after mount.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const wizard = fs.readFileSync('components/views/student-onboarding-wizard.tsx', 'utf8');

test('the wizard has no static input-otp or select import; both widgets are next/dynamic with SSR kept', () => {
  assert.doesNotMatch(wizard, /from "@\/components\/ui\/(input-otp|select)"/);
  assert.match(wizard, /import dynamic from "next\/dynamic"/);
  for (const name of ['VerificationCodeInput', 'GraduationYearSelect']) {
    const declaration = wizard.match(new RegExp(`const ${name} = dynamic\\(([^\\n]*)\\)\\n`));
    assert.ok(declaration, name);
    assert.doesNotMatch(declaration[1], /ssr:\s*false/, `${name} still server-renders when its step is visible`);
  }
  assert.match(wizard, /useEffect\(\(\) => \{ void loadVerificationCodeInput\(\); void loadGraduationYearSelect\(\) \}, \[\]\)/, 'chunks are warmed after mount');
  // Six adjacent slots (the group has no gap), each w-[clamp(28px,8vw,48px)] h-12.
  assert.match(wizard, /loading: \(\) => <div aria-hidden="true" className="h-12 w-\[calc\(6\*clamp\(28px,8vw,48px\)\)\]" \/>/, 'code placeholder keeps the six slots\' height and width');
  const slot = fs.readFileSync('components/onboarding/verification-code-input.tsx', 'utf8');
  assert.match(slot, /\[0, 1, 2, 3, 4, 5\]\.map/); assert.match(slot, /className="h-12 w-\[clamp\(28px,8vw,48px\)\]/);
  assert.match(fs.readFileSync('components/ui/input-otp.tsx', 'utf8'), /data-slot="input-otp-group"\s*className=\{cn\('flex items-center', className\)\}/, 'group has no gap, so width is exactly six slots');
  assert.match(wizard, /loading: \(\) => <div aria-hidden="true" className="h-11 w-full rounded-md border border-border" \/>/, 'select placeholder keeps the trigger size');
});

test('the split widgets keep their accessible names, autofill and the graduation-year label target', () => {
  const code = fs.readFileSync('components/onboarding/verification-code-input.tsx', 'utf8');
  for (const attribute of ['maxLength={6}', 'pattern="[0-9]*"', 'inputMode="numeric"', 'autoComplete="one-time-code"', 'aria-label="Six-digit verification code"'])
    assert.ok(code.includes(attribute), attribute);
  const year = fs.readFileSync('components/onboarding/graduation-year-select.tsx', 'utf8');
  assert.match(year, /<SelectTrigger id="onboarding-grad-year"/);
  assert.match(wizard, /<Label htmlFor="onboarding-grad-year">Graduation year<\/Label>\s*<GraduationYearSelect\s*years=\{GRAD_YEARS\}/);
  assert.match(wizard, /<VerificationCodeInput\s*value=\{step2Form\.watch\("code"\)\}/);
});

test('/signup keeps the wizard as a static import: step 1 is its first paint', () => {
  assert.match(fs.readFileSync('components/auth/signup-page-view.tsx', 'utf8'), /^import \{ StudentOnboardingWizard \} from "@\/components\/views\/student-onboarding-wizard"$/m);
  assert.match(fs.readFileSync('components/app-shell.tsx', 'utf8'), /const StudentOnboardingWizard = dynamic\(/);
});
