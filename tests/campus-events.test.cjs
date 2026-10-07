const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript"),
  { PGlite } = require("@electric-sql/pglite");
function load(file, mocks = {}) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (n) =>
      n in mocks
        ? mocks[n]
        : n.startsWith("@/lib/")
          ? load(n.replace("@/", "") + ".ts", mocks)
          : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
const lib = load("lib/campus-events.ts");
test("Eastern date windows respect midnight, week/weekend, DST gaps/folds and multi-day overlap", () => {
  const { newYorkInstant, eventDateWindow, nyDate, newYorkInput } = lib;
  assert.equal(nyDate(new Date("2026-10-06T03:59:59Z")), "2026-10-05");
  assert.equal(nyDate(new Date("2026-10-06T04:00Z")), "2026-10-06");
  for (const [day, hours] of [
    ["2026-03-08", 23],
    ["2026-11-01", 25],
  ]) {
    const w = eventDateWindow("Today", day);
    assert.equal((w.end - w.start) / 3600000, hours);
  }
  assert.throws(() => newYorkInstant("2026-03-08T02:30"), /does not exist/);
  assert.equal(
    newYorkInstant("2026-11-01T01:30").toISOString(),
    "2026-11-01T05:30:00.000Z",
  );
  assert.equal(newYorkInput("2026-11-01T06:30:00Z"), "2026-11-01T01:30");
  assert.throws(() => newYorkInstant("2026-02-30T12:00"), /valid/);
  const week = eventDateWindow("This Week", "", new Date("2026-10-07T12:00Z"));
  assert.equal(week.start.toISOString(), "2026-10-05T04:00:00.000Z");
  assert.equal(week.end.toISOString(), "2026-10-12T04:00:00.000Z");
  const weekend = eventDateWindow("Weekend", "", new Date("2026-10-11T12:00Z"));
  assert.equal(weekend.start.toISOString(), "2026-10-10T04:00:00.000Z");
  assert.equal(weekend.end.toISOString(), "2026-10-12T04:00:00.000Z");
  const overlap = (start, end, w) =>
    new Date(start) < w.end && new Date(end) > w.start;
  assert.ok(overlap("2026-10-04T20:00Z", "2026-10-06T05:00Z", week));
  assert.equal(overlap("2026-10-04T20:00Z", "2026-10-05T04:00Z", week), false);
});
test("strict editor/review inputs reject incomplete ranges, capacity, impossible RSVP settings and missing rejection reasons", () => {
  const base = {
    clubId: "00000000-0000-4000-8000-000000000001",
    title: "Event",
    description: "Details",
    date: "2030-10-01T12:00Z",
    endDate: "2030-10-01T13:00Z",
    location: "Hall",
    category: "Academic",
    rsvpEnabled: true,
    rsvpRequired: false,
    capacity: 10,
    rsvpDeadline: null,
    template: "academic",
  };
  assert.equal(lib.eventEditorSchema.safeParse(base).success, true);
  for (const patch of [
    { capacity: 0 },
    { endDate: base.date },
    { rsvpEnabled: false, rsvpRequired: true },
    { rsvpDeadline: "2030-10-02T00:00Z" },
    { status: "PUBLISHED" },
  ])
    assert.equal(
      lib.eventEditorSchema.safeParse({ ...base, ...patch }).success,
      false,
    );
  const review = { eventId: base.clubId, revision: 0, approved: false };
  assert.equal(lib.eventReviewSchema.safeParse(review).success, false);
  assert.equal(
    lib.eventReviewSchema.safeParse({ ...review, reason: "Fix location" })
      .success,
    true,
  );
});
test("publication helper and legacy reader deny pending/rejected/stale revisions but preserve ordinary meetings", () => {
  const e = {
      isPublic: true,
      audience: "RECRUITMENT",
      revision: 2,
      publication: { status: "PUBLISHED", approvedRevision: 2 },
    },
    meeting = load("lib/meetings.ts");
  assert.equal(lib.eventIsPublished(e), true);
  for (const publication of [
    null,
    { status: "PENDING", approvedRevision: 2 },
    { status: "REJECTED", approvedRevision: 2 },
    { status: "PUBLISHED", approvedRevision: 1 },
  ])
    assert.equal(lib.eventIsPublished({ ...e, publication }), false);
  assert.equal(meeting.canReadMeeting({ ...e, publication: null }, null), true);
  assert.equal(
    meeting.canReadMeeting(
      { ...e, publication: { status: "PENDING", approvedRevision: null } },
      null,
    ),
    false,
  );
});
test("complete migration chain enforces moderation, revision withdrawal, flyer ownership, RSVP constraints and restrictive database/storage RLS", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    "CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE storage_service BYPASSRLS;",
  );
  for (const name of fs.readdirSync("prisma/migrations").sort()) {
    if (name === "20261005010000_public_corkboard")
      await db.exec(
        `CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);CREATE TABLE storage.objects(id text PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;CREATE POLICY broad_bucket_legacy ON storage.buckets FOR ALL TO PUBLIC USING(true) WITH CHECK(true);CREATE POLICY broad_legacy ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true);GRANT USAGE ON SCHEMA storage TO anon,authenticated,storage_service;GRANT ALL ON storage.objects,storage.buckets TO anon,authenticated,storage_service;INSERT INTO storage.buckets VALUES('event-flyers','event-flyers',true),('unrelated','unrelated',true);`,
      );
    if (fs.existsSync(`prisma/migrations/${name}/migration.sql`))
      await db.exec(
        fs.readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
  }
  const one = async (sql) => (await db.query(sql)).rows[0];
  await db.exec(
    `INSERT INTO "User"(id,email) VALUES('student-one','student-one@virginia.edu'),('student-two','student-two@virginia.edu');INSERT INTO "Club"(id,slug,name,tagline,description,color,category)VALUES('club','club','Club','','','#fff','Academic');INSERT INTO "Event"(id,"clubId",title,date,"endDate",location,audience,"isPublic")VALUES('event','club','Draft',CURRENT_TIMESTAMP+interval '2 days',CURRENT_TIMESTAMP+interval '2 days 1 hour','Hall','RECRUITMENT',true),('other','club','Other',CURRENT_TIMESTAMP+interval '3 days',CURRENT_TIMESTAMP+interval '3 days 1 hour','Hall','RECRUITMENT',true);INSERT INTO "EventPublication"("eventId",capacity,"updatedAt")VALUES('event',1,CURRENT_TIMESTAMP),('other',null,CURRENT_TIMESTAMP);`,
  );
  assert.equal(
    (await one(`SELECT status FROM "EventPublication" WHERE "eventId"='event'`))
      .status,
    "DRAFT",
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO "EventRsvp"("eventId","userId")VALUES('event','student-one')`,
    ),
    /unavailable/,
  );
  await assert.rejects(
    db.exec(
      `UPDATE "EventPublication" SET status='PENDING' WHERE "eventId"='event'`,
    ),
    /check constraint/,
  );
  await db.exec(
    `UPDATE "EventPublication" SET status='PENDING',"submittedAt"=CURRENT_TIMESTAMP,"submittedBy"='leader' WHERE "eventId"='event'`,
  );
  await assert.rejects(
    db.exec(
      `UPDATE "EventPublication" SET status='REJECTED' WHERE "eventId"='event'`,
    ),
    /check constraint/,
  );
  await db.exec(
    `UPDATE "EventPublication" SET status='REJECTED',"rejectionReason"='Fix details' WHERE "eventId"='event'`,
  );
  await assert.rejects(
    db.exec(
      `UPDATE "EventPublication" SET status='PUBLISHED',"approvedRevision"=1,"reviewedAt"=CURRENT_TIMESTAMP,"reviewedBy"='admin',"publishedAt"=CURRENT_TIMESTAMP WHERE "eventId"='event'`,
    ),
    /revision/,
  );
  const publish = () =>
    db.exec(
      `UPDATE "EventPublication" SET status='PUBLISHED',"approvedRevision"=(SELECT revision FROM "Event" WHERE id='event'),"reviewedAt"=CURRENT_TIMESTAMP,"reviewedBy"='admin',"publishedAt"=CURRENT_TIMESTAMP WHERE "eventId"='event'`,
    );
  await publish();
  await db.exec(
    `INSERT INTO "EventRsvp"("eventId","userId")VALUES('event','student-one')`,
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO "EventRsvp"("eventId","userId")VALUES('event','student-two')`,
    ),
    /full/,
  );
  await db.exec(`DELETE FROM "EventRsvp" WHERE "eventId"='event'`);
  await db.exec(
    `INSERT INTO "EventRsvp"("eventId","userId")VALUES('event','student-two')`,
  );
  assert.equal(
    (await one(`SELECT count(*)::int n FROM "EventAttendance"`)).n,
    0,
  );
  await db.exec(
    `UPDATE "Event" SET title='Edited by legacy editor' WHERE id='event'`,
  );
  assert.equal(
    (await one(`SELECT revision FROM "Event" WHERE id='event'`)).revision,
    1,
  );
  assert.equal(
    (
      await one(
        `SELECT status,"approvedRevision" FROM "EventPublication" WHERE "eventId"='event'`,
      )
    ).status,
    "DRAFT",
  );
  await publish();
  await db.exec(
    `UPDATE "EventPublication" SET template='navy' WHERE "eventId"='event'`,
  );
  assert.equal(
    (await one(`SELECT status FROM "EventPublication" WHERE "eventId"='event'`))
      .status,
    "DRAFT",
  );
  await db.exec(
    `INSERT INTO "EventFlyer"(id,"eventId",path,mime,size,"createdBy")VALUES('flyer','other','other/private.png','image/png',10,'leader')`,
  );
  await assert.rejects(
    db.exec(`UPDATE "EventFlyer" SET path='changed.png' WHERE id='flyer'`),
    /immutable/,
  );
  await assert.rejects(
    db.exec(
      `UPDATE "EventPublication" SET "flyerId"='flyer' WHERE "eventId"='event'`,
    ),
    /another event/,
  );
  await db.exec(
    `UPDATE "EventPublication" SET "rsvpDeadline"=CURRENT_TIMESTAMP-interval '1 hour' WHERE "eventId"='event'`,
  );
  await publish();
  await db.exec(`DELETE FROM "EventRsvp" WHERE "eventId"='event'`);
  await assert.rejects(
    db.exec(
      `INSERT INTO "EventRsvp"("eventId","userId")VALUES('event','student-one')`,
    ),
    /unavailable/,
  );
  for (const table of ["EventPublication", "EventFlyer", "EventRsvp"]) {
    for (const role of ["anon", "authenticated"])
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"])
        assert.equal(
          (
            await one(
              `SELECT has_table_privilege('${role}','"${table}"','${privilege}') allowed`,
            )
          ).allowed,
          false,
        );
    await db.exec(
      `GRANT ALL ON "${table}" TO anon,authenticated;CREATE POLICY accidental_broad ON "${table}" FOR ALL TO PUBLIC USING(true) WITH CHECK(true);`,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      assert.equal((await db.query(`SELECT * FROM "${table}"`)).rows.length, 0);
      assert.equal(
        (await db.query(`DELETE FROM "${table}" RETURNING *`)).rows.length,
        0,
      );
      await db.exec("RESET ROLE");
    }
  }
  assert.equal(
    (await one(`SELECT public FROM storage.buckets WHERE id='event-flyers'`))
      .public,
    false,
  );
  await db.exec(
    `INSERT INTO storage.objects VALUES('private','event-flyers','club/event/private.png'),('other','unrelated','public.png')`,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    assert.equal(
      (
        await db.query(
          "UPDATE storage.buckets SET public=true WHERE id='event-flyers' RETURNING id",
        )
      ).rows.length,
      0,
    );
    assert.deepEqual(
      (await db.query("SELECT id FROM storage.objects")).rows.map((r) => r.id),
      ["other"],
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO storage.objects VALUES('denied','event-flyers','any.png')`,
      ),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query(
          `UPDATE storage.objects SET name='replacement.png' WHERE id='private' RETURNING id`,
        )
      ).rows.length,
      0,
    );
    await db.exec("RESET ROLE");
  }
  await db.exec("SET ROLE storage_service");
  assert.equal(
    (
      await db.query(
        "SELECT * FROM storage.objects WHERE bucket_id='event-flyers'",
      )
    ).rows.length,
    1,
  );
  await db.exec("RESET ROLE");
});
