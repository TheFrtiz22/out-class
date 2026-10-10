// Design previews and recipient-locked SMTP tests. No Auth calls, queue processing,
// account mutation, template publication, or credential output.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { parseEnv } = require('node:util'), { randomUUID, createHash } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..'), OUTPUT = path.join(ROOT, 'docs/email-design');
const SITE = 'https://www.out-class.net', RECIPIENT = 'bsb4rd@virginia.edu';
const IMPLEMENTED_AUTH = ['confirmation', 'magic-link', 'recovery', 'password-changed'];
const SURFACES = [
  ['desktop', 720, 'light', 'Desktop · light'], ['desktop-dark', 720, 'dark', 'Desktop · dark simulation'],
  ['mobile', 375, 'light', '375px · light'], ['dark', 375, 'dark', '375px · dark simulation'],
  ['narrow', 320, 'light', '320px · light'], ['narrow-dark', 320, 'dark', '320px · dark simulation'],
];
function load(file) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText)(name => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), mod, mod.exports);
  return mod.exports;
}
const { escapeEmailHtml: escape, emailArtworkRoot } = load('lib/transactional-email.ts');
function sample(html) {
  return html.replaceAll('{{ .Token }}', '246810').replaceAll('{{ .RedirectTo }}', SITE + '/reset-password').replaceAll('{{ .TokenHash }}', 'design-preview-not-a-valid-token').replaceAll('{{ .ConfirmationURL }}', SITE + '/login?email-design-preview=1').replaceAll('{{ .SiteURL }}', SITE).replaceAll('{{ .NewEmail }}', 'student@virginia.edu').replaceAll('{{ .Email }}', RECIPIENT);
}
function messages() {
  const { authEmailTemplates, authEmailSubjects } = load('lib/auth-email-templates.ts');
  const list = Object.entries(authEmailTemplates(SITE)).map(([type, m]) => ({ type, subject: authEmailSubjects[type], html: sample(m.html), text: sample(m.text), scope: IMPLEMENTED_AUTH.includes(type) ? 'Implemented Auth · hosted publication pending' : 'Provider template · no application trigger', implemented: IMPLEMENTED_AUTH.includes(type) }));
  const { invitationEmail } = load('lib/invitation-email.ts');
  for (const [type, owner, legacy] of [['member-invitation', false, false], ['administrator-invitation', true, false], ['legacy-invitation', false, true]]) list.push({ type, ...invitationEmail({ organizationName: 'Enactus at UVA', organizationLogoUrl: SITE + '/logos/enactus.png', owner, siteUrl: SITE, ...(legacy ? { legacyInvitationId: '00000000-0000-4000-8000-000000000001' } : {}) }), scope: 'Application SMTP · deployment pending', implemented: true });
  list.push({ type: 'student-claim', ...load('lib/student-claim-email.ts').studentClaimEmail({ name: 'Taylor', tokenHash: 'design-preview-not-a-valid-token', siteUrl: SITE }), scope: 'Application SMTP · deployment pending', implemented: true });
  return list;
}
function inert(html) {
  return html.replaceAll(SITE + '/auth/student-claim#token_hash=design-preview-not-a-valid-token', SITE + '/login?email-design-preview=1').replaceAll(SITE + '/reset-password#token_hash=design-preview-not-a-valid-token', SITE + '/login?email-design-preview=1').replaceAll(SITE + '/invitations/00000000-0000-4000-8000-000000000001', SITE + '/login?email-design-preview=1');
}
async function localArtwork(page) {
  // Render the exact repository assets without repeatedly fetching production.
  // Real recipient-side image loading is checked separately in Outlook.
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const assetPath = url.hostname === 'raw.githubusercontent.com' ? url.pathname.split('/public/')[1] : '.' + url.pathname;
    const file = path.resolve(ROOT, 'public', assetPath || 'missing');
    if (request.resourceType() === 'image' && file.startsWith(path.join(ROOT, 'public') + path.sep) && fs.existsSync(file)) await route.fulfill({ path: file });
    else await route.continue();
  });
}
async function render() {
  const { chromium } = require(process.env.OUTCLASS_PLAYWRIGHT_MODULE || '/private/tmp/outclass-nav-tools/node_modules/playwright');
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const list = messages(), checks = [];
  try {
    for (const stage of ['before', 'current']) {
      const dir = path.join(OUTPUT, 'previews', stage); fs.mkdirSync(dir, { recursive: true });
      for (const m of list) {
        const filename = path.join(dir, m.type + '.html');
        const html = stage === 'current' ? inert(m.html) : fs.readFileSync(filename, 'utf8').replaceAll('OutClass Audit Research Society', 'Enactus at UVA');
        if (stage === 'current') { fs.writeFileSync(filename, html); fs.writeFileSync(path.join(dir, m.type + '.txt'), inert(m.text)); }
        await Promise.all(SURFACES.map(async ([surface, width, colorScheme]) => {
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
          const page = await context.newPage();
          await localArtwork(page);
          await page.setContent(html, { waitUntil: 'networkidle' });
          const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src), unresolvedVariables: /\{\{.*?\}\}/.test(document.body.innerText), height: document.documentElement.scrollHeight, bodyFont: getComputedStyle(document.body).fontFamily }));
          await page.screenshot({ path: path.join(dir, m.type + '-' + surface + '.png'), fullPage: true });
          checks.push({ stage, type: m.type, surface, width, colorScheme, evidence: 'Chromium browser simulation with repository artwork; not an email client or remote-image fetch check', ...result });
          await context.close();
        }));
        if (stage === 'current') {
          // Inspect the Outlook selector branch independently of prefers-color-scheme.
          const context = await browser.newContext({ viewport: { width: 375, height: 900 }, colorScheme: 'light' });
          const page = await context.newPage(); await localArtwork(page); await page.setContent(html, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.documentElement.setAttribute('data-ogsc', ''));
          const branch = await page.evaluate(() => ({ bodyColor: getComputedStyle(document.querySelector('.ink')).color, paperColor: getComputedStyle(document.querySelector('.email-paper')).backgroundColor }));
          checks.push({ stage, type: m.type, surface: 'outlook-selector', evidence: 'Selector simulation only', ...branch });
          await page.screenshot({ path: path.join(dir, m.type + '-outlook-selector.png'), fullPage: true });
          await page.evaluate(() => { document.documentElement.removeAttribute('data-ogsc'); document.querySelectorAll('style').forEach(s => s.remove()); document.querySelectorAll('img').forEach(i => i.style.visibility = 'hidden'); });
          const fallback = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, textVisible: !!document.body.innerText.trim(), ctaHeight: document.querySelector('.cta')?.getBoundingClientRect().height ?? null }));
          checks.push({ stage, type: m.type, surface: 'no-head-styles-images-blocked', evidence: 'Browser fallback simulation only', ...fallback });
          await page.screenshot({ path: path.join(dir, m.type + '-fallback.png'), fullPage: true });
          await context.close();
        }
      }
    }
    fs.writeFileSync(path.join(OUTPUT, 'render-checks.json'), JSON.stringify(checks, null, 2) + '\n');
    fs.writeFileSync(path.join(OUTPUT, 'template-inventory.json'), JSON.stringify(list.map(({ html, text, ...m }) => m), null, 2) + '\n');
    gallery(list);
    const failures = checks.filter(c => c.overflow || c.unresolvedVariables || c.brokenImages?.length);
    console.log({ templates: list.length, comparisonRenders: list.length * SURFACES.length * 2, fallbackChecks: list.length * 2, failures });
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
function gallery(list) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OutClass / Email design review</title><style>
*{box-sizing:border-box}body{margin:0;background:#eeeae3;color:#142d4e;font:15px/1.6 'Segoe UI',Arial,sans-serif}header,main{max-width:1240px;margin:auto;padding:32px}header{border-bottom:2px solid #142d4e}header img{width:200px}h1{font:44px/1.15 Georgia,serif;margin:24px 0 14px}h2{font:30px/1.3 Georgia,serif;margin:0}p{max-width:760px}small,.meta{color:#596575}nav{display:flex;gap:12px;flex-wrap:wrap}select{padding:10px 14px;font:inherit;border:1px solid #596575;background:#fffdf8;color:#142d4e}article{padding:28px 0;border-bottom:1px solid #b7c0ca}.meta{margin:8px 0 20px}a{color:#142d4e}a:focus-visible,select:focus-visible{outline:3px solid #e85b19;outline-offset:3px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}figure{margin:0;min-width:0}figcaption{font-size:11px;text-transform:uppercase;letter-spacing:1.4px;margin:0 0 10px}.shot{max-width:100%;height:auto;display:block;border:1px solid #b7c0ca}.compare[data-mobile=true] .shot{width:375px}.evidence{padding:12px 16px;border-left:3px solid #e85b19;background:#fffdf8}body.night{background:#101c2c;color:#f5f0e7}body.night header{border-color:#93a9c3}body.night a,body.night small,body.night .meta{color:#b6c1cf}body.night .evidence{background:#17263a}@media(max-width:700px){header,main{padding:20px}.compare{grid-template-columns:1fr}h1{font-size:34px}}</style></head><body><header><img src="${emailArtworkRoot}/outclass-logo-light.jpeg" alt="OutClass"><h1>A campus publication.<br>An everyday essential.</h1><p>The redesigned transactional emails: official artwork, a sabre-inspired double rule, a quieter palette, and compositions shaped around the message.</p><p class="evidence"><strong>Evidence:</strong> These are Chromium browser screenshots with illustrative codes and inactive authentication links. Dark mode is a CSS simulation; image assets are loaded from the repository. These comparison images do not establish email-client compatibility. <a href="outlook-web/index.html">Separate, actual Outlook Web light/dark evidence</a> is available for the eight final implemented templates.</p><nav><label>View <select id="surface">${SURFACES.map(([id, , , label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><label>Jump to <select id="template"><option value="">All templates</option>${list.map(m => `<option value="${m.type}">${m.type}</option>`).join('')}</select></label></nav><p><small>“Before” is the actual working-tree design at the start of this redesign, including the prior audit’s local improvements. <a href="../email-audit/previews/before/index.html">Older deployed audit baseline</a> · <a href="REPORT.md">Design and publication report</a></small></p></header><main>${list.map(m => `<article id="${m.type}"><h2>${escape(m.type.replaceAll('-', ' '))}</h2><p class="meta">${escape(m.scope)} · <a href="previews/current/${m.type}.html">HTML</a> · <a href="previews/current/${m.type}.txt">Plain text preview</a></p><div class="compare"><figure><figcaption>Before / local audit design</figcaption><a data-stage="before" data-type="${m.type}" href="previews/before/${m.type}-desktop.png"><img class="shot" src="previews/before/${m.type}-desktop.png" alt="${m.type} before, desktop light"></a></figure><figure><figcaption>After / OutClass editorial system</figcaption><a data-stage="current" data-type="${m.type}" href="previews/current/${m.type}-desktop.png"><img class="shot" src="previews/current/${m.type}-desktop.png" alt="${m.type} redesigned, desktop light"></a></figure></div></article>`).join('')}</main><script>
document.getElementById('surface').addEventListener('change',e=>{const surface=e.target.value;document.body.classList.toggle('night',surface.includes('dark'));document.querySelectorAll('[data-stage]').forEach(a=>{const src='previews/'+a.dataset.stage+'/'+a.dataset.type+'-'+surface+'.png';a.href=src;a.querySelector('img').src=src;a.querySelector('img').alt=a.dataset.type+', '+a.dataset.stage+', '+surface});document.querySelectorAll('.compare').forEach(c=>c.dataset.mobile=String(!surface.startsWith('desktop')))});document.getElementById('template').addEventListener('change',e=>{if(e.target.value)document.getElementById(e.target.value).scrollIntoView({behavior:'smooth'})});</script></body></html>`;
  fs.writeFileSync(path.join(OUTPUT, 'index.html'), html + '\n');
}
async function send() {
  const credentialFile = process.env.OUTCLASS_DESIGN_ENV_FILE || '/private/tmp/outclass-email-design-private/production.env';
  const env = parseEnv(fs.readFileSync(credentialFile, 'utf8'));
  const password = env.SMTP_PASSWORD && env.SMTP_PASSWORD !== '[SENSITIVE]' ? env.SMTP_PASSWORD : env.RESEND_API_KEY;
  if (!password || password === '[SENSITIVE]') throw Error('Existing SMTP credential unavailable.');
  if (env.SMTP_HOST && env.SMTP_HOST !== '[SENSITIVE]' && env.SMTP_HOST !== 'smtp.resend.com') throw Error('Unexpected SMTP host.');
  const transport = require('nodemailer').createTransport({ host: 'smtp.resend.com', port: 465, secure: true, auth: { user: 'resend', pass: password }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
  const ledgerFile = path.join(OUTPUT, 'send-results.json');
  const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : [];
  try {
    for (const m of messages().filter(m => m.implemented)) {
      const revision = process.argv.includes('--asset-fix') ? 'asset-fix' : 'initial';
      if (ledger.some(r => r.type === m.type && (r.revision || 'initial') === revision)) continue; // Never automatically retry accepted or uncertain sends.
      const previewNotice = 'OutClass design preview. The code is illustrative; authentication links are inactive. No account, password, membership, or permissions were changed.';
      const html = inert(m.html).replace(/(<body[^>]*>)/, `$1<p class="muted" style="margin:12px 16px;color:#596575;font:12px/20px Arial,sans-serif">${previewNotice}</p>`);
      const text = previewNotice + '\n\n' + inert(m.text);
      const record = { type: m.type, revision, recipient: RECIPIENT, subject: '[OutClass Design Test] ' + m.subject + ' / ' + m.type + (revision === 'asset-fix' ? ' / final artwork' : ''), attemptedAt: new Date().toISOString(), scope: 'SMTP design preview; no Auth workflow or invitation record', contentHash: createHash('sha256').update(html).digest('hex'), submission: 'attempting', delivery: 'unconfirmed', inbox: 'not observed', messageId: `<${randomUUID()}@www.out-class.net>` };
      ledger.push(record); fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');
      try {
        const info = await transport.sendMail({ from: { name: 'OutClass', address: 'no-reply@updates.out-class.net' }, to: RECIPIENT, subject: record.subject, html, text, messageId: record.messageId });
        Object.assign(record, { submission: info.accepted?.includes(RECIPIENT) ? 'accepted by SMTP provider' : 'rejected', acceptedAt: new Date().toISOString(), messageId: info.messageId, providerId: info.response?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || null });
      } catch (error) { Object.assign(record, { submission: error.responseCode >= 400 ? 'provider rejected' : 'uncertain; do not retry automatically', error: { code: error.code, responseCode: error.responseCode, command: error.command } }); }
      fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n'); console.log(record);
    }
  } finally { transport.close(); }
}
if (require.main === module) (async () => { if (process.argv[2] === 'render') await render(); else if (process.argv[2] === 'send') await send(); else throw Error('Usage: node scripts/email-design.cjs render|send'); })().catch(() => { console.error('Email design command failed; no secrets logged.'); process.exitCode = 1; });
module.exports = { messages, sample, inert, SURFACES, gallery };
