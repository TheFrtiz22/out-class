const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertDisposableSmtpImage } = require('../scripts/disposable-smtp-image.cjs');

test('disposable SMTP accepts only versioned Supabase Mailpit images at official CLI fallback registries', () => {
  for (const prefix of ['public.ecr.aws/', 'ghcr.io/', 'docker.io/', '']) {
    assert.doesNotThrow(() => assertDisposableSmtpImage(prefix + 'supabase/mailpit:v1.22.3'));
    assert.doesNotThrow(() => assertDisposableSmtpImage(prefix + 'supabase/mailpit:v1.22.3@sha256:' + 'a'.repeat(64)));
  }
});
test('disposable SMTP rejects foreign registries, owners, images, unversioned tags and argument injection', () => {
  for (const image of [null, '', 'evil.test/supabase/mailpit:v1.22.3', 'ghcr.io/other/mailpit:v1.22.3', 'ghcr.io/supabase/other:v1.22.3', 'ghcr.io/supabase/mailpit:latest', 'ghcr.io/supabase/mailpit', 'ghcr.io/supabase/mailpit:v1.22.3 --privileged', 'ghcr.io/supabase/mailpit:v1.22.3\n', 'ghcr.io/supabase/mailpit:v1.22.3@sha256:bad']) {
    assert.throws(() => assertDisposableSmtpImage(image), /Unexpected local SMTP image/);
  }
});
