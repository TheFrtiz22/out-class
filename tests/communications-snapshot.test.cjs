const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { loader } = require('./helpers/communications-loader.cjs');

test('batched communications snapshot preserves inbox/legacy conversation revisions, ownership and disable checks with two queries', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const root = path.resolve('prisma/migrations');
  for (const name of fs.readdirSync(root).sort()) { const file = path.join(root, name, 'migration.sql'); if (fs.existsSync(file)) await db.exec(fs.readFileSync(file, 'utf8')); }
  await db.exec(`INSERT INTO "User" (id,email) VALUES ('a','a@virginia.edu'),('b','b@virginia.edu'),('empty','empty@virginia.edu');
    INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ('club-a','snapshot-a','A','','','#142d45','Other'),('club-b','snapshot-b','B','','','#142d45','Other');
    INSERT INTO "ClubMember"(id,"userId","clubId") VALUES ('member-a','a','club-a'),('member-b','b','club-b');
    INSERT INTO "ClubConversation"(id,"clubId","studentId",subject,"updatedAt") VALUES ('conversation-a','club-a','a','Legacy','2026-10-18T10:00:00'),('conversation-b','club-b','b','Other','2026-10-18T10:00:00');
    INSERT INTO "UserNotification"(id,"userId","eventKey",type,title,body,href,"updatedAt","readAt","archivedAt") VALUES
      ('a-unread','a','snapshot-a1','PLATFORM','Synthetic','','/','2026-10-18T10:01:00',NULL,NULL),
      ('a-read','a','snapshot-a2','PLATFORM','Synthetic','','/','2026-10-18T10:02:00','2026-10-18T10:02:00',NULL),
      ('a-archived','a','snapshot-a3','PLATFORM','Synthetic','','/','2026-10-18T10:03:00',NULL,'2026-10-18T10:03:00'),
      ('b-unread','b','snapshot-b1','PLATFORM','Synthetic','','/','2026-10-18T10:04:00',NULL,NULL);`);
  let calls = 0;
  const raw = async (strings, ...values) => { calls++; return (await db.query(strings.reduce((sql, part, index) => sql + (index ? '$' + index : '') + part, ''), values)).rows; };
  const api = loader({ '@/utils/prisma': { prisma: { $queryRaw: raw } } })('lib/communications-snapshot.ts');
  const read = async id => { calls = 0; const value = await api.communicationsSnapshot(id); assert.equal(calls, 2); assert.deepEqual(Object.keys(value).sort(), ['revision', 'unread']); return value; };
  // PGlite parses timestamp-without-time-zone fixture values in the host zone.
  const revision = (total, updated, unread, conversations) => createHash('sha256').update(JSON.stringify([total, updated && new Date(updated), unread, [[conversations && new Date(conversations), conversations ? '1' : '0']]])).digest('hex');
  const first = await read('a'); assert.equal(first.unread, 1); assert.equal(first.revision, revision(3, '2026-10-18T10:03:00', 1, '2026-10-18T10:00:00'));
  const empty = await read('empty'); assert.equal(empty.unread, 0); assert.equal(empty.revision, revision(0, null, 0, null));
  const second = await read('b'); assert.equal(second.unread, 1); assert.notEqual(second.revision, first.revision);
  await db.exec(`UPDATE "UserNotification" SET "updatedAt"='2026-10-18T10:05:00' WHERE id='b-unread'; UPDATE "ClubConversation" SET "updatedAt"='2026-10-18T10:05:00' WHERE id='conversation-b';`);
  assert.deepEqual(await read('a'), first, 'Another account/club cannot alter the revision');
  await db.exec(`UPDATE "UserNotification" SET "readAt"='2026-10-18T10:06:00',"updatedAt"='2026-10-18T10:06:00' WHERE id='a-unread'`);
  const seen = await read('a'); assert.equal(seen.unread, 0); assert.notEqual(seen.revision, first.revision);
  await db.exec(`UPDATE "UserNotification" SET "archivedAt"=NULL,"updatedAt"='2026-10-18T10:07:00' WHERE id='a-archived'`);
  const restored = await read('a'); assert.equal(restored.unread, 1); assert.notEqual(restored.revision, seen.revision);
  await db.exec(`UPDATE "ClubConversation" SET "updatedAt"='2026-10-18T10:08:00' WHERE id='conversation-a'`);
  const conversation = await read('a'); assert.equal(conversation.unread, restored.unread); assert.notEqual(conversation.revision, restored.revision, 'Legacy conversation invalidation is retained');
  await db.exec(`UPDATE "ClubMember" SET status='LEFT' WHERE id='member-a'`);
  const revoked = await read('a'); assert.notEqual(revoked.revision, conversation.revision, 'Revoked conversation access no longer contributes');
  await db.exec(`UPDATE "User" SET "disabledAt"=NOW() WHERE id='a'`); await assert.rejects(api.communicationsSnapshot('a'), /unavailable/);
  await assert.rejects(api.communicationsSnapshot('missing'), /unavailable/);
});
