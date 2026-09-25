// Optional isolated PostgreSQL migration check; run with @electric-sql/pglite available in NODE_PATH.
const { PGlite } = require("@electric-sql/pglite")
const fs = require("node:fs")
const assert = require("node:assert/strict")
;(async () => {
  const db = new PGlite()
  const dir = require("node:path").resolve(__dirname, "../prisma/migrations") + "/"
  await db.exec(fs.readFileSync(dir + "20260923000000_baseline/migration.sql", "utf8"))
  await db.exec(
    `INSERT INTO "User" (id,email,role) VALUES ('owner','owner@virginia.edu','CLUB_ADMIN'),('lead','lead@virginia.edu','STUDENT'),('member','member@virginia.edu','STUDENT'); INSERT INTO "Club" (id,slug,name,tagline,description,color,category) VALUES ('club','club','Club','','','#ffffff','Academic'); INSERT INTO "ClubMember" (id,"clubId","userId",role) VALUES ('m1','club','owner','PRESIDENT'),('m2','club','lead','RECRUITMENT_LEAD'),('m3','club','member','GENERAL_MEMBER');`,
  )
  await db.exec(
    `INSERT INTO "PipelineRound" (id,"clubId",name,"order") VALUES ('round','club','Review',0); INSERT INTO "Application" (id,"studentId","clubId","roundId",status) VALUES ('app','member','club','round','IN_REVIEW'); INSERT INTO "ApplicationQuestion" (id,"clubId",prompt,type) VALUES ('q','club','Why this club?','ESSAY'); INSERT INTO "ApplicationAnswer" (id,"applicationId","questionId",response) VALUES ('answer','app','q','Existing answer'); INSERT INTO "Evaluation" (id,"applicationId","interviewerId",round,score,notes) VALUES ('evaluation','app','m1','Review',8,'Existing review'); INSERT INTO "InterviewSlot" (id,"clubId","startTime","endTime",location) VALUES ('slot','club',NOW(),NOW()+interval '1 hour','Hall'); INSERT INTO "InterviewBooking" (id,"slotId","applicationId") VALUES ('booking','slot','app');`,
  )
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated; GRANT SELECT ON ALL TABLES IN SCHEMA public TO PUBLIC",
  )
  await db.exec(fs.readFileSync(dir + "20260923010000_capabilities/migration.sql", "utf8"))
  assert.equal(
    (
      await db.query(
        "SELECT has_table_privilege('authenticated', '\"ClubMember\"', 'UPDATE') AS allowed",
      )
    ).rows[0].allowed,
    false,
  )
  assert.equal(
    (await db.query("SELECT has_table_privilege('anon', '\"Application\"', 'SELECT') AS allowed"))
      .rows[0].allowed,
    false,
  )
  assert.equal(
    (await db.query("SELECT status FROM \"Application\" WHERE id='app'")).rows[0].status,
    "IN_REVIEW",
  )
  assert.equal(
    (await db.query("SELECT response FROM \"ApplicationAnswer\" WHERE id='answer'")).rows[0]
      .response,
    "Existing answer",
  )
  assert.equal(
    (await db.query("SELECT score FROM \"Evaluation\" WHERE id='evaluation'")).rows[0].score,
    8,
  )
  assert.equal(
    (await db.query('SELECT "applicationId" FROM "InterviewBooking" WHERE id=\'booking\'')).rows[0]
      .applicationId,
    "app",
  )
  const { rows } = await db.query('SELECT * FROM "ClubMember" ORDER BY id')
  assert.equal(rows.length, 3)
  assert.equal(rows[0].isOwner, true)
  assert.equal(rows[1].isOwner, false)
  assert.ok(rows[1].permissions.includes("recruitment.manage"))
  assert.ok(rows[2].permissions.includes("applications.review"))
  assert.ok(!rows[2].permissions.includes("decisions.manage"))
  assert.equal((await db.query('SELECT * FROM "PlatformAdmin"')).rows.length, 0)
  await db.exec(
    `INSERT INTO "AuditLog" (id,"actorId",action,"targetId") VALUES ('log','owner','test','club')`,
  )
  await assert.rejects(db.exec(`DELETE FROM "AuditLog"`), /append-only/)
  assert.equal(
    (await db.query("SELECT * FROM \"User\" WHERE id='owner'")).rows[0].role,
    "CLUB_ADMIN",
  )
  console.log(
    "Baseline + additive migration applied; all existing identities/memberships preserved; access backfill verified; no implicit platform admin; append-only audit enforced.",
  )
  await db.exec(`INSERT INTO "Club" (id,slug,name,tagline,description,color,category) VALUES ('existing-mii','custom-mii','McIntire Investment Institute','Keep me','Existing profile','#ffffff','Finance')`)
  const claimsSql = fs.readFileSync(dir + "20260924000000_club_claims/migration.sql", "utf8")
  await db.exec(claimsSql)
  assert.ok((await db.query(`SELECT "claimedAt" FROM "Club" WHERE id='club'`)).rows[0].claimedAt)
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM "Club" WHERE name='McIntire Investment Institute'`)).rows[0].count, 1)
  assert.equal((await db.query(`SELECT tagline FROM "Club" WHERE id='existing-mii'`)).rows[0].tagline, 'Keep me')
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM "Club" WHERE "directorySource" IS NOT NULL AND "claimedAt" IS NULL AND "acceptanceRate" IS NULL AND "aumValue" IS NULL`)).rows[0].count, 2)
  await db.exec(claimsSql.slice(claimsSql.indexOf('LOCK TABLE'), claimsSql.lastIndexOf('COMMIT;')))
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM "Club"`)).rows[0].count, 4)
  console.log("Claim migration preserves owners/profiles; directory preload avoids duplicates and fabricated statistics.")
  await db.exec(fs.readFileSync(dir + "20260924010000_anonymous_review_tests/migration.sql", "utf8"))
  assert.equal((await db.query(`SELECT "anonymousReview" FROM "PipelineRound" WHERE id='round'`)).rows[0].anonymousReview, false)
  assert.equal((await db.query(`SELECT "testRequirement" FROM "Club" WHERE id='club'`)).rows[0].testRequirement, 'OPTIONAL')
  await assert.rejects(db.exec(`UPDATE "Club" SET "testRequirement"='INVALID' WHERE id='club'`), /check constraint/)
  await db.exec(`INSERT INTO "StudentProfile" (id,"userId","firstName","lastName","computingId",major,"gradYear","actScore") VALUES ('profile','member','Test','Student','test','Economics',2028,32)`)
  assert.equal((await db.query(`SELECT "satScore" FROM "StudentProfile" WHERE id='profile'`)).rows[0].satScore, null)
  await assert.rejects(db.exec(`UPDATE "StudentProfile" SET "actScore"=37 WHERE id='profile'`), /check constraint/)
  console.log("Anonymous review/test migration preserves default behavior and enforces valid ACT scores and requirements.")
  await db.exec(fs.readFileSync(dir + "20260924020000_interview_kits/migration.sql", "utf8"))
  assert.deepEqual((await db.query(`SELECT "interviewKit" FROM "PipelineRound" WHERE id='round'`)).rows[0].interviewKit, [])
  assert.equal((await db.query(`SELECT notes FROM "Evaluation" WHERE id='evaluation'`)).rows[0].notes, 'Existing review')
  await db.exec(`INSERT INTO "InterviewRecord" (id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","updatedAt") VALUES ('record','app','m1','round','[]','{}',false,NOW())`)
  assert.equal((await db.query(`SELECT has_table_privilege('authenticated', '"InterviewRecord"', 'SELECT') AS allowed`)).rows[0].allowed,false)
  await assert.rejects(db.exec(`INSERT INTO "InterviewRecord" (id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","updatedAt") VALUES ('duplicate','app','m1','round','[]','{}',false,NOW())`), /unique constraint/)
  console.log("Interview kit migration preserves existing evaluations and enforces session uniqueness and API isolation.")
  await db.exec(`INSERT INTO "Event" (id,"clubId",title,date,location,"isPublic") VALUES ('private-meeting','club','Member meeting',NOW(),'Hall',false); INSERT INTO "EventAttendance" (id,"eventId","studentId") VALUES ('old-attendance','private-meeting','member')`)
  await db.exec(fs.readFileSync(dir + "20260924030000_meetings/migration.sql", "utf8"))
  assert.equal((await db.query(`SELECT audience FROM "Event" WHERE id='private-meeting'`)).rows[0].audience,'MEMBERS')
  assert.equal((await db.query(`SELECT count(*)::int AS count FROM "EventAttendance" WHERE id='old-attendance'`)).rows[0].count,1)
  await assert.rejects(db.exec(`UPDATE "Event" SET "isPublic"=true WHERE id='private-meeting'`),/check constraint/)
  assert.equal((await db.query(`SELECT has_table_privilege('authenticated','"MeetingCheckInToken"','SELECT') AS allowed`)).rows[0].allowed,false)
  console.log("Unified meeting migration preserves event IDs/attendance and protects member visibility and QR secrets.")
  await db.exec(`INSERT INTO "ClubTask" (id,"clubId",title,"assigneeId") VALUES ('legacy-task','club','Semester work','member'); INSERT INTO "User" (id,email,role) VALUES ('leaving','leaving@virginia.edu','STUDENT'); INSERT INTO "ClubMember" (id,"userId","clubId") VALUES ('leaving-member','leaving','club')`)
  await db.exec(fs.readFileSync(dir + "20260924040000_member_tasks/migration.sql", "utf8"))
  assert.equal((await db.query(`SELECT title FROM "ClubTask" WHERE id='legacy-task'`)).rows[0].title, 'Semester work')
  const recipient=(await db.query(`SELECT * FROM "TaskAssignment" WHERE "taskId"='legacy-task'`)).rows[0]
  assert.equal(recipient.memberId,'m3'); assert.equal(recipient.userId,'member'); assert.match(recipient.id,/^[a-f0-9-]{36}$/)
  assert.equal((await db.query(`SELECT has_table_privilege('authenticated','"TaskAssignment"','SELECT') AS allowed`)).rows[0].allowed,false)
  assert.equal((await db.query(`SELECT has_table_privilege('anon','"TaskFile"','SELECT') AS allowed`)).rows[0].allowed,false)
  await db.exec(`INSERT INTO "TaskAssignment" (id,"taskId","memberId","userId",text,"submittedAt") VALUES ('former-work','legacy-task','leaving-member','leaving','Preserved work',NOW()); DELETE FROM "ClubMember" WHERE id='leaving-member'`)
  const former=(await db.query(`SELECT * FROM "TaskAssignment" WHERE id='former-work'`)).rows[0]
  assert.equal(former.memberId,null); assert.equal(former.text,'Preserved work')
  await assert.rejects(db.exec(`INSERT INTO "TaskAssignment" (id,"taskId","memberId","userId") VALUES ('duplicate-task','legacy-task','m3','member')`),/unique constraint/)
  await assert.rejects(db.exec(`UPDATE "ClubTask" SET "projectId"=id WHERE id='legacy-task'`),/check constraint/)
  console.log("Task migration preserves legacy assignments and former-member submissions; unique recipients and browser isolation verified.")
  await db.exec(fs.readFileSync(dir + "20260925000000_platform_view_sessions/migration.sql", "utf8"))
  assert.equal((await db.query(`SELECT has_table_privilege('authenticated','"PlatformViewSession"','SELECT') AS allowed`)).rows[0].allowed,false)
  assert.equal((await db.query(`SELECT has_table_privilege('anon','"PlatformViewSession"','INSERT') AS allowed`)).rows[0].allowed,false)
  await db.exec(`INSERT INTO "PlatformViewSession" (id,"tokenHash","actorId","targetUserId",reason,"expiresAt") VALUES ('view','hashed-token','owner','member','Support inspection',NOW()+interval '30 minutes')`)
  await assert.rejects(db.exec(`INSERT INTO "PlatformViewSession" (id,"tokenHash","actorId","targetUserId",reason,"expiresAt") VALUES ('duplicate-view','hashed-token','owner','member','Support inspection',NOW()+interval '30 minutes')`),/unique constraint/)
  assert.equal((await db.query(`SELECT text FROM "TaskAssignment" WHERE id='former-work'`)).rows[0].text,'Preserved work')
  console.log("Platform view sessions are isolated from browser roles; token hashes unique; existing user and task data retained.")
  await db.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
