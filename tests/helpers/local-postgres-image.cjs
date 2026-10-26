// Both official mirrors serve the same immutable disposable database image.
// Keep registry availability separate from test execution and database safety.
const { spawnSync } = require('node:child_process');
const pinnedPostgres = '17.11.0.002@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53';
const postgresImages = Object.freeze([
  `ghcr.io/supabase/postgres:${pinnedPostgres}`,
  `public.ecr.aws/supabase/postgres:${pinnedPostgres}`,
]);

function ensurePostgresImage(run = spawnSync) {
  for (const image of postgresImages) {
    if (run('docker', ['image', 'inspect', image], { stdio: 'ignore' }).status === 0) return image;
  }
  for (const image of postgresImages) {
    if (run('docker', ['pull', image], { stdio: 'inherit', timeout: 120000 }).status === 0) return image;
  }
  throw Error('Could not download the pinned disposable PostgreSQL image from either official mirror.');
}

module.exports = { ensurePostgresImage, postgresImages };
