const fs = require('node:fs'), assert = require('node:assert/strict');
function assertLocalConfig(config) {
  assert.equal(config.projectId, 'outclass-announcement-e2e');
  for (const [value, port] of [[config.appUrl, '3117'], [config.status.API_URL, '56321'], [config.status.DB_URL, '56322']]) {
    const url = new URL(value); assert.ok(['localhost', '127.0.0.1'].includes(url.hostname)); assert.equal(url.port, port);
  }
  return config;
}
function readConfig(file) { return assertLocalConfig(JSON.parse(fs.readFileSync(file, 'utf8'))); }
function localEnv(config) {
  assertLocalConfig(config); const s = config.status;
  return { ...process.env, DATABASE_URL: s.DB_URL, POSTGRES_PRISMA_URL: s.DB_URL, POSTGRES_URL: s.DB_URL, POSTGRES_URL_NON_POOLING: s.DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: s.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY: s.ANON_KEY,
    SUPABASE_SECRET_KEY: s.SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY: s.SERVICE_ROLE_KEY, OUTCLASS_SITE_URL: config.appUrl,
    OUTCLASS_PUBLISH_BUILD: '1', NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: 'false', SMTP_HOST: '', SMTP_PASSWORD: '',
    RESEND_API_KEY: '', RESEND_FROM_EMAIL: '', COMMUNICATIONS_EMAIL_ENABLED: 'false', CRON_SECRET: config.cronSecret };
}
module.exports = { assertLocalConfig, readConfig, localEnv };
