const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migrationRoot = path.resolve('prisma/migrations');
const migrations = fs.readdirSync(migrationRoot).filter(n => fs.existsSync(path.join(migrationRoot, n, 'migration.sql'))).sort();
const onboarding = '20261001010000_club_onboarding';
const read = name => fs.readFileSync(path.join(migrationRoot, name, 'migration.sql'), 'utf8');

test('full migration stack preserves legacy data and enforces onboarding constraints and browser isolation', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  for (const name of migrations.filter(n => n < onboarding)) await db.exec(read(name));
  await db.exec(`
    INSERT INTO "User" (id,email) VALUES ('owner','owner@virginia.edu'),('member','member@virginia.edu'),('other','other@virginia.edu');
    INSERT INTO "Club" (id,slug,name,tagline,description,color,category) VALUES ('club','onboarding-test','Club','','','#ffffff','Academic');
    INSERT INTO "ClubMember" (id,"clubId","userId","isOwner",permissions,role) VALUES
      ('owner-member','club','owner',true,ARRAY['members.manage'],'PRESIDENT'),('ordinary-member','club','member',false,ARRAY[]::text[],'GENERAL_MEMBER');
    INSERT INTO "ClubInvitation" (id,"clubId",email,"invitedBy","expiresAt","declinedAt") VALUES
      ('legacy-declined','club','other@virginia.edu','owner',NOW()+interval '1 day',NOW());
    INSERT INTO "ClubInvitation" (id,"clubId",email,"invitedBy","expiresAt","acceptedAt") VALUES
      ('legacy-accepted','club','member@virginia.edu','owner',NOW()+interval '1 day',NOW());
    INSERT INTO "ClubInvitation" (id,"clubId",email,"invitedBy","expiresAt") VALUES
      ('legacy-pending','club','other@virginia.edu','owner',NOW()+interval '1 day'),
      ('legacy-pending-duplicate','club','other@virginia.edu','owner',NOW()+interval '1 day');
    ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;
  `);
  await db.exec(read(onboarding));
  for (const name of migrations.filter(n => n > onboarding)) await db.exec(read(name));
  const one = async sql => (await db.query(sql)).rows[0];
  assert.equal((await one(`SELECT "schoolId" FROM "Club" WHERE id='club'`)).schoolId, 'school-uva');
  assert.deepEqual(await one(`SELECT role,"accessRole",permissions,status FROM "ClubMember" WHERE id='owner-member'`), {
    role: 'PRESIDENT', accessRole: 'OWNER', permissions: ['members.manage'], status: 'ACTIVE',
  });
  assert.equal((await one(`SELECT status FROM "ClubInvitation" WHERE id='legacy-declined'`)).status, 'DECLINED');
  assert.equal((await one(`SELECT "claimedUserId" FROM "ClubInvitation" WHERE id='legacy-accepted'`)).claimedUserId, 'member');
  assert.equal((await one(`SELECT count(*)::int AS n FROM "ClubInvitation" WHERE id LIKE 'legacy-pending%'`)).n, 2);

  // Every new table denies browser CRUD even when default grants would have exposed it.
  for (const table of ['School','SchoolIdentifierType','SchoolIdentity','RosterImport','RosterImportRow','InvitationDelivery','ClubInvitation','ClubMember']) {
    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass`, ['"' + table + '"'])).rows[0].relrowsecurity, true);
    for (const role of ['anon','authenticated']) for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) {
      assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, '"'+table+'"', privilege])).rows[0].allowed, false);
    }
  }
  await db.exec('SET ROLE authenticated');
  await assert.rejects(db.exec('SELECT * FROM "SchoolIdentity"'), /permission denied/);
  await assert.rejects(db.exec(`UPDATE "ClubMember" SET "isOwner"=true`), /permission denied/);
  await db.exec('RESET ROLE');
  // A later permissive policy/grant cannot override the restrictive server-only guard.
  await db.exec(`GRANT SELECT, INSERT ON "SchoolIdentity" TO authenticated;
    CREATE POLICY test_permissive_identity ON "SchoolIdentity" FOR ALL TO authenticated USING (true) WITH CHECK (true);
    SET ROLE authenticated;`);
  assert.equal((await db.query('SELECT * FROM "SchoolIdentity"')).rows.length, 0);
  await assert.rejects(db.exec(`INSERT INTO "SchoolIdentity" (id,"schoolId","identifierTypeId",identifier,"normalizedIdentifier") VALUES ('browser','school-uva','school-uva-computing-id','browser','browser')`), /permission denied|row-level security/);
  await db.exec('RESET ROLE; DROP POLICY test_permissive_identity ON "SchoolIdentity"; REVOKE ALL ON "SchoolIdentity" FROM authenticated;');

  // Normalization and multi-school keys do not create fake accounts.
  await db.exec(`INSERT INTO "School" (id,key,name) VALUES ('penn','penn','Penn');
    INSERT INTO "SchoolIdentifierType" (id,"schoolId",key,label) VALUES ('penn-key','penn','pennkey','PennKey');
    INSERT INTO "SchoolIdentity" (id,"schoolId","identifierTypeId",identifier,"normalizedIdentifier") VALUES
      ('identity','school-uva','school-uva-computing-id',' AbC123 ','WRONG'),('penn-identity','penn','penn-key','ABC123','WRONG');`);
  assert.equal((await one(`SELECT "normalizedIdentifier" FROM "SchoolIdentity" WHERE id='identity'`)).normalizedIdentifier, 'abc123');
  assert.equal((await one(`SELECT count(*)::int AS n FROM "User"`)).n, 3);
  await assert.rejects(db.exec(`INSERT INTO "SchoolIdentity" (id,"schoolId","identifierTypeId",identifier,"normalizedIdentifier") VALUES ('duplicate','school-uva','school-uva-computing-id','ABC123','abc123')`), /unique constraint/);
  await assert.rejects(db.exec(`INSERT INTO "SchoolIdentity" (id,"schoolId","identifierTypeId",identifier,"normalizedIdentifier") VALUES ('wrong-type','penn','school-uva-computing-id','abc','abc')`), /no rows|foreign key/);
  await assert.rejects(db.exec(`UPDATE "SchoolIdentity" SET "userId"='member' WHERE id='identity'`), /check constraint/);
  await db.exec(`UPDATE "SchoolIdentity" SET "userId"='member',"verifiedAt"=NOW(),"verificationMethod"='EMAIL_LOCAL_PART' WHERE id='identity'`);
  await assert.rejects(db.exec(`UPDATE "SchoolIdentity" SET "userId"='other' WHERE id='identity'`), /immutable/);
  await assert.rejects(db.exec(`UPDATE "SchoolIdentifierType" SET "emailDomain"='example.edu' WHERE id='school-uva-computing-id'`), /reconciliation/);

  const invite = (name, identity = 'identity', actor = 'owner') => db.query(`INSERT INTO "ClubInvitation" (id,"clubId","schoolId","schoolIdentityId",email,"invitedBy","expiresAt",purpose,"invitedName","invitedYear") VALUES ($1,'club','school-uva',$2,'abc123@virginia.edu',$3,NOW()+interval '7 days','MEMBERSHIP','Student Name','2028')`, [name, identity, actor]);
  await invite('pending');
  await assert.rejects(invite('duplicate-pending'), /unique constraint/);
  await assert.rejects(invite('outsider-grant', 'identity', 'member'), /not authorized/);
  await db.exec(`UPDATE "ClubMember" SET "accessRole"='ADMIN',permissions=ARRAY['leaders.manage','members.manage'] WHERE id='ordinary-member'`);
  await assert.rejects(db.exec(`INSERT INTO "ClubInvitation" (id,"clubId","schoolId","schoolIdentityId",email,"invitedBy","expiresAt",purpose,"requestedRole") VALUES ('unauthorized-owner','club','school-uva','identity','abc123@virginia.edu','member',NOW()+interval '7 days','OWNER_DESIGNATION','OWNER')`), /not authorized/);
  await db.exec(`UPDATE "ClubMember" SET "accessRole"='MEMBER',permissions=ARRAY[]::text[] WHERE id='ordinary-member'`);
  await assert.rejects(invite('wrong-school', 'penn-identity'), /no rows|foreign key/);
  await db.exec(`UPDATE "ClubInvitation" SET "dismissedAt"=NOW() WHERE id='pending'`);
  assert.equal((await one(`SELECT status FROM "ClubInvitation" WHERE id='pending'`)).status, 'PENDING');
  assert.equal((await one(`SELECT count(*)::int AS n FROM "ClubMember"`)).n, 2);
  await db.exec(`UPDATE "ClubInvitation" SET "dismissedAt"=NULL WHERE id='pending'`);
  await assert.rejects(db.exec(`UPDATE "ClubInvitation" SET "acceptedAt"=NOW(),"claimedUserId"='other' WHERE id='pending'`), /verified identity/);
  await db.exec(`UPDATE "ClubInvitation" SET "acceptedAt"=NOW(),"claimedUserId"='member' WHERE id='pending'`);
  assert.equal((await one(`SELECT status FROM "ClubInvitation" WHERE id='pending'`)).status, 'ACCEPTED');
  await assert.rejects(db.exec(`UPDATE "ClubInvitation" SET status='PENDING',"acceptedAt"=NULL WHERE id='pending'`), /Terminal invitations/);
  await invite('next');
  await db.exec(`UPDATE "ClubInvitation" SET "declinedAt"=NOW() WHERE id='next'`);
  await invite('revocable');
  await db.exec(`UPDATE "ClubInvitation" SET "revokedAt"=NOW() WHERE id='revocable'`);
  await invite('expirable');
  await db.exec(`UPDATE "ClubInvitation" SET "expiresAt"=NOW()-interval '1 day' WHERE id='expirable'`);
  assert.equal((await one(`SELECT status FROM "ClubInvitation" WHERE id='expirable'`)).status, 'EXPIRED');
  await invite('after-expiry');

  await assert.rejects(db.exec(`INSERT INTO "ClubMember" (id,"userId","clubId") VALUES ('duplicate-member','member','club')`), /unique constraint/);
  await assert.rejects(db.exec(`UPDATE "ClubMember" SET "isOwner"=false WHERE id='owner-member'`), /another active owner/);
  await assert.rejects(db.exec(`UPDATE "ClubMember" SET status='SUSPENDED',permissions=ARRAY['members.manage'] WHERE id='ordinary-member'`), /check constraint/);
  await db.exec(`UPDATE "ClubMember" SET status='LEFT' WHERE id='ordinary-member'`);
  await assert.rejects(db.exec(`INSERT INTO "ClubMember" (id,"userId","clubId") VALUES ('second-member','member','club')`), /unique constraint/);

  await assert.rejects(db.exec(`INSERT INTO "RosterImport" (id,"clubId","uploadedById",filename,"idempotencyKey") VALUES ('unauthorized','club','member','roster.csv','x')`), /member-management/);
  await db.exec(`INSERT INTO "RosterImport" (id,"clubId","uploadedById",filename,"idempotencyKey","rowCount") VALUES ('import','club','owner','roster.csv','import-key',2);
    INSERT INTO "RosterImportRow" (id,"importId","clubId","rowNumber",input,"schoolIdentityId","invitationId",status) VALUES
      ('row-1','import','club',1,'{"name":"Student Name","year":"2028","computing_id":"abc123"}','identity','after-expiry','INVITATION_CREATED');
    INSERT INTO "RosterImportRow" (id,"importId","clubId","rowNumber",input,status,errors) VALUES
      ('row-2','import','club',2,'{"computing_id":"bad value"}','INVALID','[{"field":"computing_id","code":"INVALID"}]');
    UPDATE "RosterImport" SET "successfulRows"=1,"failedRows"=1,status='COMPLETED',"completedAt"=NOW() WHERE id='import';`);
  await assert.rejects(db.exec(`UPDATE "RosterImport" SET "successfulRows"=3 WHERE id='import'`), /check constraint/);
  await assert.rejects(db.exec(`UPDATE "RosterImportRow" SET "schoolIdentityId"='penn-identity' WHERE id='row-1'`), /another school/);
  await assert.rejects(db.exec(`UPDATE "RosterImport" SET "uploadedById"='other' WHERE id='import'`), /provenance/);
  await assert.rejects(db.exec(`UPDATE "RosterImportRow" SET input='{}' WHERE id='row-1'`), /immutable/);
  await db.exec(`INSERT INTO "InvitationDelivery" (id,"invitationId","requestedById","recipientEmail","idempotencyKey") VALUES ('delivery','after-expiry','owner','abc123@virginia.edu','send-1')`);
  await assert.rejects(db.exec(`INSERT INTO "InvitationDelivery" (id,"invitationId","requestedById","recipientEmail","idempotencyKey") VALUES ('duplicate-delivery','after-expiry','owner','abc123@virginia.edu','send-1')`), /unique constraint/);
  await assert.rejects(db.exec(`DELETE FROM "RosterImport" WHERE id='import'`), /foreign key/);
});
