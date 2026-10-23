const { test } = require('node:test'), assert = require('node:assert/strict');
const { assertMailpitImage } = require('./helpers/local-mailpit-image.cjs');
test('local SMTP TLS fixture accepts official Supabase/Mailpit mirrors and rejects untrusted images', () => {
  for (const repo of ['public.ecr.aws/supabase/mailpit', 'ghcr.io/supabase/mailpit', 'axllent/mailpit', 'docker.io/axllent/mailpit', 'supabase/mailpit', 'docker.io/supabase/mailpit']) {
    assertMailpitImage(repo + ':v1.22.3'); assertMailpitImage(repo + ':v1.22.3@sha256:' + 'a'.repeat(64));
  }
  for (const image of ['evil.test/supabase/mailpit:v1.22.3', 'ghcr.io/supabase/mailpit-evil:v1.22.3', 'public.ecr.aws/supabase/mailpit:latest', 'axllent/mailpit:v1.22.3 extra', 'axllent/mailpit:v1.22.3@sha256:invalid', 'ghcr.io/attacker/mailpit:v1.22.3']) assert.throws(() => assertMailpitImage(image), /Unexpected/);
});
