// Repository contract checks only. Never connects to or executes SQL on a database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Prisma } = require('@prisma/client');
const read = path => fs.readFileSync(path, 'utf8');
const migrations = 'prisma/migrations/';

test('generated User has no local credential field and retains nullable suspension', () => {
  const fields = Prisma.dmmf.datamodel.models.find(m => m.name === 'User').fields;
  assert.equal(fields.some(f => f.name === 'passwordHash'), false);
  assert.equal(fields.find(f => f.name === 'disabledAt').isRequired, false);
  assert.match(read('prisma/schema.prisma'), /disabledAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
});

test('nine existing indexes are represented exactly once in schema and fresh baseline', () => {
  const schema = read('prisma/schema.prisma');
  const baseline = read(migrations + '20260923000000_baseline/migration.sql');
  const indexes = {
    Application: ['clubId', 'roundId', 'studentId'],
    ApplicationQuestion: ['clubId'], ClubMember: ['clubId'],
    Meeting: ['clubId'], EventAttendance: ['studentId'],
    InterviewSlot: ['clubId'], PipelineRound: ['clubId'],
  };
  for (const [model, fields] of Object.entries(indexes)) {
    const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))[1];
    for (const field of fields) {
      const table = model === 'Meeting' ? 'Event' : model;
      const name = `${table}_${field}_idx`;
      assert.equal(block.split(`@@index([${field}]`).length - 1, 1);
      assert.ok(block.includes(`@@index([${field}], map: "${name}")`));
      assert.equal(baseline.split(`CREATE INDEX "${name}"`).length - 1, 1);
    }
  }
  assert.doesNotMatch(baseline, /passwordHash/);
});

test('capabilities guards suspension type without rewriting existing values', () => {
  const sql = read(migrations + '20260923010000_capabilities/migration.sql');
  assert.match(sql, /IF NOT FOUND THEN\s+ALTER TABLE public\."User" ADD COLUMN "disabledAt" TIMESTAMPTZ\(3\)/);
  assert.match(sql, /ELSIF existing_type <> 'timestamptz'::regtype THEN\s+RAISE EXCEPTION/);
  assert.doesNotMatch(sql, /ALTER COLUMN "disabledAt"|SET "disabledAt"|USING.*disabledAt/i);
});

test('required arrays have non-null empty defaults and every migration is transactional', () => {
  const caps = read(migrations + '20260923010000_capabilities/migration.sql');
  const tasks = read(migrations + '20260924040000_member_tasks/migration.sql');
  assert.equal(caps.match(/"permissions" TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/g).length, 2);
  for (const field of ['groups', 'requirements']) {
    assert.ok(tasks.includes(`"${field}" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`));
  }
  for (const name of fs.readdirSync(migrations).filter(n => /^\d/.test(n))) {
    const sql = read(migrations + name + '/migration.sql').trim();
    assert.ok(sql.startsWith('BEGIN;'), name);
    assert.ok(sql.endsWith('COMMIT;'), name);
  }
});

test('canonical Auth SQL rejects cross-ID email collisions and stale installers cannot run', () => {
  const sql = read('prisma/setup_auth_trigger.sql');
  assert.ok(sql.includes('NEW.email := lower(trim(NEW.email))'));
  assert.ok(sql.includes("@virginia\\.edu$"));
  assert.ok(sql.includes('lower(trim(email)) = NEW.email AND id <> NEW.id::text'));
  assert.match(sql, /RAISE EXCEPTION 'Email belongs to a different public user/);
  assert.ok(sql.includes('ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email'));
  assert.doesNotMatch(sql, /ON CONFLICT \(email\)|SET\s+"?id"?\s*=|DELETE FROM/i);
  for (const file of ['db_test9.js', 'db_test10.js']) {
    assert.match(read(file), /throw new Error/);
    assert.doesNotMatch(read(file), /PrismaClient|executeRaw|fetch\(/);
  }
});
