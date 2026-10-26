const { test } = require('node:test'), assert = require('node:assert/strict');
const { ensurePostgresImage, postgresImages } = require('./helpers/local-postgres-image.cjs');

function fixture({ cached = [], downloadable = [] } = {}) {
  const calls = [];
  const run = (command, args) => {
    assert.equal(command, 'docker');
    calls.push(args);
    return { status: (args[0] === 'image' ? cached : downloadable).includes(args.at(-1)) ? 0 : 1 };
  };
  return { run, calls };
}
test('disposable PostgreSQL accepts only official mirrors of the identical pinned image', () => {
  assert.deepEqual(postgresImages.map(image => image.split(':').slice(1).join(':')), [
    '17.11.0.002@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53',
    '17.11.0.002@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53',
    '17.11.0.002@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53',
  ]);
  assert.ok(Object.isFrozen(postgresImages));
});
test('a cached image from any official registry needs no network download', () => {
  for (const image of postgresImages) {
    const f = fixture({ cached: [image] });
    assert.equal(ensurePostgresImage(f.run), image);
    assert.equal(f.calls.filter(args => args[0] === 'pull').length, 0);
  }
});
test('a primary registry failure falls back to the same image on the official mirror', () => {
  const f = fixture({ downloadable: [postgresImages[1]] });
  assert.equal(ensurePostgresImage(f.run), postgresImages[1]);
  assert.deepEqual(f.calls.filter(args => args[0] === 'pull').map(args => args[1]), postgresImages.slice(0, 2));
});
test('Docker Hub serves the identical pinned image when GHCR and ECR are unavailable', () => {
  const f = fixture({ downloadable: [postgresImages[2]] });
  assert.equal(ensurePostgresImage(f.run), postgresImages[2]);
  assert.deepEqual(f.calls.filter(args => args[0] === 'pull').map(args => args[1]), postgresImages);
});
test('failed downloads stop the fixture without selecting another image or starting a container', () => {
  const f = fixture();
  assert.throws(() => ensurePostgresImage(f.run), /any official mirror/);
  assert.equal(f.calls.some(args => args[0] === 'run'), false);
});
