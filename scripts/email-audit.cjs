// Audit artifacts and real SMTP tests. Never reads credentials during rendering.
// Sending is hard-locked to the user-authorized mailbox and never processes a DB queue.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { parseEnv } = require('node:util'), { randomUUID } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..'), OUTPUT = path.join(ROOT, 'docs/email-audit');
const RECIPIENT = 'bsb4rd@virginia.edu', SITE = 'https://www.out-class.net';
function load(file) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText)(name => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), mod, mod.exports);
  return mod.exports;
}
const subjects = { confirmation: 'Verify your UVA email — OutClass', 'magic-link': 'Your OutClass sign-in code', recovery: 'Reset your password', 'password-changed': 'Your password was changed', invite: "You've been invited", 'email-change': 'Confirm your new email address', reauthentication: 'Your verification code' };
function samples(html) {
  return html.replaceAll('{{ .Token }}', '246810').replaceAll('{{ .RedirectTo }}', SITE + '/reset-password').replaceAll('{{ .TokenHash }}', 'audit-preview-not-a-valid-token').replaceAll('{{ .ConfirmationURL }}', SITE + '/login').replaceAll('{{ .SiteURL }}', SITE).replaceAll('{{ .NewEmail }}', RECIPIENT).replaceAll('{{ .Email }}', RECIPIENT);
}
function templates(stage = 'current') {
  const messages = [];
  for (const type of Object.keys(subjects)) {
    const proposed = path.join(ROOT, 'supabase/templates', type + '.html');
    const filename = stage === 'current' && fs.existsSync(proposed) ? proposed : path.join(OUTPUT, 'hosted', type + '.html');
    messages.push({ type, subject: subjects[type], html: samples(fs.readFileSync(filename, 'utf8')), source: path.relative(ROOT, filename), scope: ['confirmation', 'magic-link', 'recovery', 'password-changed'].includes(type) ? 'implemented Auth template' : 'provider-native; no application trigger' });
  }
  const invitation = stage === 'before' ? (() => {
    const source = require('node:child_process').execFileSync('git', ['show', 'HEAD:lib/invitation-email.ts'], { cwd: ROOT, encoding: 'utf8' });
    const mod = { exports: {} }; new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod, mod.exports); return mod.exports.invitationEmail;
  })() : load('lib/invitation-email.ts').invitationEmail;
  for (const [type, owner, legacy] of [['member-invitation', false, false], ['administrator-invitation', true, false], ['legacy-invitation', false, true]]) {
    messages.push({ type, ...invitation({ organizationName: 'OutClass Audit Research Society', owner, siteUrl: SITE, ...(legacy ? { legacyInvitationId: '00000000-0000-4000-8000-000000000001' } : {}) }), scope: 'application SMTP template' });
  }
  if (stage === 'before') messages.push({ type: 'student-claim', subject: 'Claim your OutClass student account', text: `Hello Taylor,\n\nYour OutClass account is ready. Choose your own password using this single-use invitation:\n${SITE}/auth/student-claim#token_hash=audit-preview-not-a-valid-token\n\nThis link expires according to the university authentication service's invitation policy. If it has expired, request another invitation.`, scope: 'application SMTP template' });
  else messages.push({ type: 'student-claim', ...load('lib/student-claim-email.ts').studentClaimEmail({ name: 'Taylor', tokenHash: 'audit-preview-not-a-valid-token', siteUrl: SITE }), scope: 'application SMTP template' });
  return messages;
}
function buildAuth() {
  const { transactionalEmailHtml } = load('lib/transactional-email.ts');
  for (const [type, title, intro, footer] of [
    ['confirmation', 'Verify your UVA email', 'Enter this code in OutClass:', 'If you didn’t create an OutClass account, you can ignore this email.'],
    ['magic-link', 'Your sign-in code', 'Enter this code in OutClass to sign in:', 'If you didn’t request this code, you can ignore this email.'],
  ]) fs.writeFileSync(path.join(ROOT, 'supabase/templates', type + '.html'), transactionalEmailHtml({ title, preview: intro + ' The code expires in one hour.', siteUrl: SITE, body: `<p>${intro}</p><p class="otp" style="margin:24px 0;padding:16px 0;font-size:36px;font-weight:bold;letter-spacing:8px;line-height:1.3">{{ .Token }}</p><p class="muted" style="color:#586473;font-size:14px">This code expires in one hour and can only be used once. Never share it with anyone.</p>`, footer }) + '\n');
  // Preserve the established password-email layout; fix only compatibility/contrast/URLs.
  for (const type of ['recovery', 'password-changed']) {
    let html = fs.readFileSync(path.join(OUTPUT, 'hosted', type + '.html'), 'utf8');
    html = html.replaceAll('https://out-class.vercel.app/', SITE + '/').replaceAll('#8a8f99', '#586473').replaceAll('#9a9da5', '#586473').replaceAll('#a4a19c', '#586473').replaceAll('#e5723a', '#a63b0b');
    html = html.replace('</head>', `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>@media only screen and (max-width:600px){.email-card>tbody>tr>td{padding-left:24px!important;padding-right:24px!important}h1{font-size:26px!important}}@media(prefers-color-scheme:dark){body,.email-bg,.email-bg>table{background-color:#0e1b2d!important}.email-card{background-color:#17263c!important}.email-card td{color:#c3cbd6!important}.email-card p,.email-card h1,.email-card strong{color:#f4f6f8!important}.email-card a{color:#f4f6f8!important}.email-card td[bgcolor]{background:#295c88!important}.notice{background-color:#233750!important}.brand{background-color:#ffffff!important}.copyright{color:#c3cbd6!important}}</style></head>`);
    html = html.replace('<body ', '<body class="email-bg" ').replace('<!-- Email Card --> <table', '<!-- Email Card --> <table class="email-card"').replace('<!-- Logo --> <tr> <td', '<!-- Logo --> <tr> <td class="brand"').replace('background-color: #f7f5f0; border:', 'background-color: #f7f5f0; border:');
    html = html.replace('<td style=" background-color: #f7f5f0;', '<td class="notice" style=" background-color: #f7f5f0;');
    const preview = type === 'recovery' ? 'Choose a new password for your OutClass account.' : 'The password for your OutClass account was changed.';
    html = html.replace(/(<body[^>]*>)/, `$1<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preview}</div>`);
    html = html.replace('<!-- Copyright --> <p', '<!-- Copyright --> <p class="copyright"');
    html = html.replace('<!-- Email Card -->', '<!-- Email Card --><!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->').replace('</table> <!-- Copyright -->', '</table><!--[if mso]></td></tr></table><![endif]--> <!-- Copyright -->');
    fs.writeFileSync(path.join(ROOT, 'supabase/templates', type + '.html'), html + '\n');
  }
}
async function render(stage) {
  const { chromium } = require(process.env.OUTCLASS_PLAYWRIGHT_MODULE || '/private/tmp/outclass-nav-tools/node_modules/playwright');
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const dir = path.join(OUTPUT, 'previews', stage), results = [], messages = templates(stage);
  fs.mkdirSync(dir, { recursive: true });
  try {
    for (const m of messages) {
      const html = m.html || `<!doctype html><html><body><pre style="white-space:pre-wrap;font:16px/1.6 Arial">${load('lib/transactional-email.ts').escapeEmailHtml(m.text)}</pre></body></html>`;
      fs.writeFileSync(path.join(dir, m.type + '.html'), html);
      if (m.text) fs.writeFileSync(path.join(dir, m.type + '.txt'), m.text);
      for (const [surface, width, colorScheme] of [['desktop', 720, 'light'], ['mobile', 375, 'light'], ['narrow', 320, 'light'], ['dark', 375, 'dark']]) {
        const context = await browser.newContext({ viewport: { width, height: 960 }, colorScheme });
        const page = await context.newPage();
        await page.setContent(html, { waitUntil: 'networkidle' });
        const checks = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).length, unresolvedVariables: /\{\{.*?\}\}/.test(document.body.innerText), links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')), bodyText: document.body.innerText.replace(/246810/g, '[illustrative code]') }));
        await page.screenshot({ path: path.join(dir, m.type + '-' + surface + '.png'), fullPage: true });
        results.push({ type: m.type, surface, width, colorScheme, ...checks });
        await context.close();
      }
    }
    fs.writeFileSync(path.join(dir, 'checks.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(OUTPUT, 'template-inventory.json'), JSON.stringify(messages.map(({ html, text, ...rest }) => rest), null, 2));
    const esc = load('lib/transactional-email.ts').escapeEmailHtml;
    fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OutClass email audit — ${stage}</title><style>body{margin:0;padding:32px;background:#f8f7f4;color:#142d4e;font:16px/1.5 Arial}article{margin:32px 0;border-top:1px solid #dce0e3;padding-top:24px}.grid{display:flex;gap:24px;align-items:start;flex-wrap:wrap}figure{margin:0;max-width:100%}img{max-width:100%;height:auto;border:1px solid #dce0e3}a{color:#142d4e}</style><h1>OutClass email audit: ${stage}</h1><p>Rendered HTML with illustrative data and inert authentication links. Browser previews do not establish Gmail or Outlook delivery or rendering.</p>${messages.map(m => `<article><h2>${esc(m.type)}</h2><p>${esc(m.subject)}</p><p>${esc(m.scope)} · <a href="${m.type}.html">HTML</a>${m.text ? ` · <a href="${m.type}.txt">Plain text</a>` : ''}</p><div class="grid">${[['desktop', 560], ['mobile', 280], ['dark', 280]].map(([s, w]) => `<figure><figcaption>${s}</figcaption><a href="${m.type}-${s}.png"><img src="${m.type}-${s}.png" width="${w}" alt="${m.type}, ${s}"></a></figure>`).join('')}</div></article>`).join('')}</html>`);
    console.log({ stage, templates: messages.length, renders: results.length, failures: results.filter(r => r.overflow || r.brokenImages || r.unresolvedVariables).map(({ type, surface, overflow, brokenImages, unresolvedVariables }) => ({ type, surface, overflow, brokenImages, unresolvedVariables })) });
  } finally { await browser.close(); }
}
async function send() {
  const e = parseEnv(fs.readFileSync(process.env.OUTCLASS_AUDIT_ENV_FILE || '/private/tmp/outclass-email-audit-private/production.env', 'utf8'));
  if (!e.RESEND_API_KEY || e.RESEND_API_KEY === '[SENSITIVE]') throw Error('Existing Resend credential unavailable.');
  const transport = require('nodemailer').createTransport({ host: 'smtp.resend.com', port: 465, secure: true, auth: { user: 'resend', pass: e.RESEND_API_KEY }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
  const ledgerFile = path.join(OUTPUT, 'send-results.json');
  const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : [];
  try {
    for (const m of templates('current')) {
      // Auth is exercised through the provider workflow separately, never substituted with SMTP previews.
      if (!['member-invitation', 'administrator-invitation', 'legacy-invitation', 'student-claim', 'confirmation', 'password-changed'].includes(m.type)) continue;
      if (ledger.some(x => x.type === m.type)) continue; // Never blindly retry uncertain outcomes.
      const id = randomUUID(), subject = '[OutClass Test] ' + m.subject;
      let html = m.html, text = m.text;
      const preview = ['legacy-invitation', 'student-claim', 'confirmation', 'password-changed'].includes(m.type);
      if (!text) text = m.type === 'confirmation' ? 'Verify your UVA email\n\nIllustrative audit code: 246810. This preview code does not authenticate an account.\n\nOutClass — One profile. Every opportunity.' : 'Your OutClass password was changed.\n\nThis is a design and delivery preview; no password change occurred.\n\nIf you did not change your password, reset it and contact OutClass support.\n\nOutClass — One profile. Every opportunity.';
      if (preview) {
        html = html.replaceAll(SITE + '/auth/student-claim#token_hash=audit-preview-not-a-valid-token', SITE + '/auth/student-claim').replaceAll(SITE + '/invitations/00000000-0000-4000-8000-000000000001', SITE + '/settings/organizations');
        text = text.replaceAll(SITE + '/auth/student-claim#token_hash=audit-preview-not-a-valid-token', SITE + '/auth/student-claim').replaceAll(SITE + '/invitations/00000000-0000-4000-8000-000000000001', SITE + '/settings/organizations');
      }
      html = html.replace(/(<body[^>]*>)/, '$1<p style="margin:16px;padding:12px;background:#fff1e8;color:#142d4e;font:14px/1.6 Arial">Authorized OutClass audit test. No real membership or account invitation was created. Authentication links in this preview are inactive.</p>');
      text = 'Authorized OutClass audit test. No real membership or account invitation was created. Authentication links in this preview are inactive.\n\n' + text;
      const record = { type: m.type, recipient: RECIPIENT, subject, attemptedAt: new Date().toISOString(), scope: preview ? 'SMTP template preview; no Auth or invitation record' : 'SMTP template send; no invitation queue/action', messageId: `<${id}@www.out-class.net>`, submission: 'attempting', delivery: 'unconfirmed', inbox: 'not observed' };
      ledger.push(record); fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2));
      try {
        const info = await transport.sendMail({ from: { name: 'OutClass', address: 'no-reply@updates.out-class.net' }, to: RECIPIENT, subject, html, text, messageId: record.messageId });
        Object.assign(record, { submission: info.accepted?.includes(RECIPIENT) ? 'accepted by SMTP provider' : 'rejected', acceptedAt: new Date().toISOString(), providerResponse: info.response, messageId: info.messageId, providerId: info.response?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || null });
      } catch (error) { Object.assign(record, { submission: error.responseCode >= 400 ? 'provider rejected' : 'uncertain; do not retry automatically', error: { code: error.code, responseCode: error.responseCode, command: error.command } }); }
      fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2)); console.log(record);
    }
  } finally { transport.close(); }
}
(async () => { const command = process.argv[2]; if (command === 'build') buildAuth(); else if (command === 'render') await render(process.argv[3] || 'current'); else if (command === 'send') await send(); else throw Error('Usage: node scripts/email-audit.cjs build|render [before|current]|send'); })().catch(() => { console.error('Email audit command failed; no secrets logged.'); process.exitCode = 1; });
