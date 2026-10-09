const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { Actor, totp } = require("./helpers/onboarding-e2e.cjs"),
  { PrismaClient } = require("@prisma/client"),
  { createClient } = require("@supabase/supabase-js");
const ts = require("typescript");
function load(file, mocks) {
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
const filename = process.env.OUTCLASS_CORKBOARD_E2E_CONFIG;
test(
  "real local Auth + server actions + PostgreSQL + private Storage: moderation, revision replacement, privacy, RSVP concurrency and attendee authorization",
  { skip: !filename },
  async (t) => {
    const c = JSON.parse(fs.readFileSync(filename));
    assert.equal(c.projectId, "outclass-corkboard-e2e");
    for (const [url, port] of [
      [c.status.API_URL, "56321"],
      [c.status.DB_URL, "56322"],
      [c.appUrl, "3108"],
    ]) {
      const u = new URL(url);
      assert.ok(["localhost", "127.0.0.1"].includes(u.hostname));
      assert.equal(u.port, port);
    }
    c.buildDir = path.resolve(".next-publish");
    const db = new PrismaClient({ datasourceUrl: c.status.DB_URL });
    t.after(() => db.$disconnect());
    await db.eventPublication.deleteMany({
      where: { event: { clubId: c.clubId } },
    });
    await db.meeting.deleteMany({ where: { clubId: c.clubId } });
    const actors = {};
    for (const role of ["leader", "admin", "student", "outsider"]) {
      const a = new Actor(c);
      await a.signIn(c.identities[role].email, c.identities[role].password);
      actors[role] = a;
    }
    const anon = new Actor(c),
      { leader, admin, student, outsider } = actors;
    const verified = await admin.client.auth.mfa.challengeAndVerify({
      factorId: c.identities.admin.factorId,
      code: totp(c.identities.admin.totpSecret),
    });
    assert.equal(verified.error, null);
    // Exercise the current fresh password + MFA elevation gate, not only AAL2.
    const elevate = body => admin.request('/api/platform/elevation', {
      method: 'POST', headers: { origin: c.appUrl, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal((await elevate({ action: 'password', password: c.identities.admin.password })).status, 200);
    assert.equal((await elevate({ action: 'verify', code: totp(c.identities.admin.totpSecret) })).status, 200);

    const action = (actor, name, ...args) =>
        actor.action("actions/campus-events.ts", name, args),
      legacy = (_actor, name, ...args) =>
        load("actions/events.ts", {
          "@/utils/prisma": { prisma: db },
          "@/actions/meetings": {},
        })[name](...args);
    const start = new Date(Date.now() + 7 * 86400000),
      end = new Date(+start + 7200000),
      base = {
        clubId: c.clubId,
        title: "Integration Consulting Night",
        description:
          "Meet student members and alumni. Structured details are authoritative.",
        date: start.toISOString(),
        endDate: end.toISOString(),
        location: "New Cabell Hall · Room 135",
        category: "Professional",
        contact: "fixture@virginia.edu",
        rsvpEnabled: true,
        rsvpRequired: true,
        capacity: 1,
        rsvpDeadline: null,
        template: "academic",
        useTemplate: true,
      };
    await assert.rejects(action(outsider, "saveCampusEvent", base));
    await assert.rejects(
      action(leader, "saveCampusEvent", { ...base, clubId: c.otherClubId }),
    );
    await assert.rejects(
      action(leader, "reviewCampusEvent", {
        eventId: c.clubId,
        revision: 0,
        approved: true,
      }),
    );
    let draft = await action(leader, "saveCampusEvent", base);
    assert.equal(draft.status, "DRAFT");
    const id = draft.id;
    const invisible = async () => {
      assert.equal(await action(anon, "getPublicCampusEvent", id), null);
      assert.ok(
        !(
          await action(anon, "getPublicCorkboard", {
            query: "Integration Consulting",
          })
        ).events.some((e) => e.id === id),
      );
      assert.ok(
        !(await legacy(anon, "getClubEvents", c.clubId)).events.some(
          (e) => e.id === id,
        ),
      );
      const meetings = await outsider.action(
        "actions/meetings.ts",
        "listMeetings",
        [c.clubId],
      );
      assert.ok(!meetings.some((e) => e.id === id));
      const projection = await anon.action(
        "actions/club-directory.ts",
        "getPublicClub",
        [c.clubId],
      );
      assert.ok(!projection.club.publicEvents.some((e) => e.id === id));
      const directory = await anon.action(
        "actions/club-directory.ts",
        "getClubDirectory",
        [],
      );
      assert.ok(
        !directory.clubs
          .find((club) => club.id === c.clubId)
          .publicEvents.some((e) => e.id === id),
      );
    };
    await invisible();
    const command = async (command) => {
      draft = await action(leader, "commandCampusEvent", {
        eventId: id,
        clubId: c.clubId,
        revision: draft.revision,
        command,
      });
      return draft;
    };
    await command("SUBMIT");
    assert.equal(draft.status, "PENDING");
    await invisible();
    await assert.rejects(
      action(student, "reviewCampusEvent", {
        eventId: id,
        revision: draft.revision,
        approved: true,
      }),
    );
    await assert.rejects(
      action(admin, "reviewCampusEvent", {
        eventId: id,
        revision: draft.revision,
        approved: false,
      }),
    );
    // A platform grant does not let administrators moderate an event they submitted/own.
    await db.clubMember.create({
      data: {
        userId: c.identities.admin.id,
        clubId: c.clubId,
        permissions: ["meetings.manage"],
      },
    });
    await assert.rejects(
      action(admin, "reviewCampusEvent", {
        eventId: id,
        revision: draft.revision,
        approved: true,
      }),
    );
    await db.clubMember.delete({
      where: {
        userId_clubId: { userId: c.identities.admin.id, clubId: c.clubId },
      },
    });
    await action(admin, "reviewCampusEvent", {
      eventId: id,
      revision: draft.revision,
      approved: false,
      reason: "Please clarify the location.",
    });
    draft = (await action(leader, "listClubCampusEvents", c.clubId)).find(
      (e) => e.id === id,
    );
    assert.equal(draft.status, "REJECTED");
    assert.equal(draft.rejectionReason, "Please clarify the location.");
    await invisible();
    // Real actor provenance blocks self-review after a support impersonation ends.
    const supportDraft = await action(leader, "saveCampusEvent", {
      ...base,
      title: "Support-authored conflict",
    });
    await action(leader, "commandCampusEvent", {
      eventId: supportDraft.id,
      clubId: c.clubId,
      revision: supportDraft.revision,
      command: "SUBMIT",
    });
    await db.auditLog.create({
      data: {
        actorId: c.identities.admin.id,
        effectiveUserId: c.identities.leader.id,
        action: "event.submitted",
        targetId: supportDraft.id,
        clubId: c.clubId,
      },
    });
    await assert.rejects(
      action(admin, "reviewCampusEvent", {
        eventId: supportDraft.id,
        revision: supportDraft.revision,
        approved: true,
      }),
    );
    await action(leader, "commandCampusEvent", {
      eventId: supportDraft.id,
      clubId: c.clubId,
      revision: supportDraft.revision,
      command: "CANCEL",
    });
    // Validated upload is private, scoped, and withdraws any existing approval.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMqsAAAAASUVORK5CYII=",
      "base64",
    );
    function form(revision = draft.revision, mime = "image/png", bytes = png) {
      const f = new FormData();
      f.set("eventId", id);
      f.set("clubId", c.clubId);
      f.set("revision", String(revision));
      f.set("file", new File([bytes], "../../bad-name.png", { type: mime }));
      return f;
    }
    await assert.rejects(
      outsider.action("actions/event-flyers.ts", "uploadEventFlyer", [form()]),
    );
    await assert.rejects(
      leader.action("actions/event-flyers.ts", "uploadEventFlyer", [
        form(draft.revision, "image/png", Buffer.from("<svg/>")),
      ]),
    );
    await assert.rejects(
      leader.action("actions/event-flyers.ts", "uploadEventFlyer", [
        form(draft.revision, "image/png", Buffer.alloc(5242881)),
      ]),
    );
    const uploaded = await leader.action(
      "actions/event-flyers.ts",
      "uploadEventFlyer",
      [form()],
    );
    draft = (await action(leader, "listClubCampusEvents", c.clubId)).find(
      (e) => e.id === id,
    );
    assert.equal(draft.revision, uploaded.revision);
    assert.ok(draft.flyerUrl.includes("preview=1"));
    let publicUrl = `/api/event-flyers?eventId=${id}&revision=${draft.revision}`;
    assert.equal((await anon.request(publicUrl)).status, 404);
    assert.equal((await outsider.request(draft.flyerUrl)).status, 403);
    const preview = await leader.request(draft.flyerUrl);
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("content-type"), "image/png");
    assert.equal(
      preview.headers.get("cache-control"),
      "private, no-store, max-age=0",
    );
    assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png);
    const flyer = await db.eventFlyer.findFirst({ where: { eventId: id } });
    assert.ok(flyer.path.startsWith(`${c.clubId}/${id}/`));
    assert.ok(!flyer.path.includes("bad-name"));
    const privateDirect = await fetch(
      `${c.status.API_URL}/storage/v1/object/public/event-flyers/${flyer.path}`,
    );
    assert.ok(!privateDirect.ok);
    const denied = await student.client.storage
      .from("event-flyers")
      .download(flyer.path);
    assert.ok(denied.error);
    const deniedUpload = await student.client.storage
      .from("event-flyers")
      .upload("foreign.png", png, { contentType: "image/png" });
    assert.ok(deniedUpload.error);
    const bucketChange = await student.client.storage.updateBucket(
      "event-flyers",
      { public: true },
    );
    assert.ok(bucketChange.error);
    await command("SUBMIT");
    await action(admin, "reviewCampusEvent", {
      eventId: id,
      revision: draft.revision,
      approved: true,
    });
    const published = await action(anon, "getPublicCampusEvent", id);
    assert.equal(published.title, base.title);
    assert.equal(published.flyerUrl, publicUrl);
    assert.ok(!JSON.stringify(published).includes(flyer.path));
    assert.equal((await anon.request(publicUrl)).status, 200);
    assert.ok(
      (
        await action(anon, "getPublicCorkboard", {
          query: "Integration Consulting",
          required: true,
          category: "Professional",
          clubId: c.clubId,
          location: "Cabell",
        })
      ).events.some((e) => e.id === id),
    );
    const before = await Promise.all([
      db.application.count(),
      db.clubMember.count(),
      db.eventAttendance.count(),
    ]);
    const contenders = await Promise.allSettled([
      action(student, "setCampusEventRsvp", { eventId: id, going: true }),
      action(outsider, "setCampusEventRsvp", { eventId: id, going: true }),
    ]);
    assert.equal(contenders.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await db.eventRsvp.count({ where: { eventId: id } }), 1);
    const winner = contenders[0].status === "fulfilled" ? student : outsider,
      loser = winner === student ? outsider : student;
    const winnerId = winner.user.id;
    await Promise.all([
      action(winner, "setCampusEventRsvp", { eventId: id, going: true }),
      action(winner, "setCampusEventRsvp", { eventId: id, going: true }),
    ]);
    assert.equal(await db.eventRsvp.count({ where: { eventId: id } }), 1);
    assert.deepEqual(
      await Promise.all([
        db.application.count(),
        db.clubMember.count(),
        db.eventAttendance.count(),
      ]),
      before,
    );
    await assert.rejects(
      action(outsider, "getCampusEventAttendees", c.clubId, id),
    );
    await assert.rejects(
      action(leader, "getCampusEventAttendees", c.otherClubId, id),
    );
    const attendees = await action(
      leader,
      "getCampusEventAttendees",
      c.clubId,
      id,
    );
    assert.equal(attendees.length, 1);
    const round = await db.pipelineRound.create({
      data: {
        clubId: c.clubId,
        name: "Anonymous fixture",
        order: 0,
        anonymousReview: true,
      },
    });
    const application = await db.application.create({
      data: {
        studentId: winnerId,
        clubId: c.clubId,
        roundId: round.id,
        status: "SUBMITTED",
      },
    });
    const anonymous = await action(
      leader,
      "getCampusEventAttendees",
      c.clubId,
      id,
    );
    assert.equal(anonymous[0].name, "Anonymous applicant");
    assert.equal(anonymous[0].email, null);
    assert.ok(!JSON.stringify(anonymous).includes(winnerId));
    await db.application.delete({ where: { id: application.id } });
    await action(winner, "setCampusEventRsvp", { eventId: id, going: false });
    await action(loser, "setCampusEventRsvp", { eventId: id, going: true });
    assert.equal(await db.eventRsvp.count({ where: { eventId: id } }), 1);
    draft = await action(leader, "saveCampusEvent", {
      ...base,
      id,
      revision: draft.revision,
      title: "Private revised event",
      useTemplate: false,
    });
    assert.equal(draft.status, "DRAFT");
    await invisible();
    assert.equal((await anon.request(publicUrl)).status, 404);
    const myRsvps = await action(loser, "getMyCampusEventRsvps");
    assert.equal(
      myRsvps.find((r) => r.eventId === id).title,
      "Event unavailable",
    );
    assert.ok(!JSON.stringify(myRsvps).includes("Private revised"));
    await action(loser, "setCampusEventRsvp", { eventId: id, going: false });
    await command("SUBMIT");
    await action(admin, "reviewCampusEvent", {
      eventId: id,
      revision: draft.revision,
      approved: true,
    });
    assert.equal(
      (await action(anon, "getPublicCampusEvent", id)).title,
      "Private revised event",
    );
    publicUrl = `/api/event-flyers?eventId=${id}&revision=${draft.revision}`;
    assert.equal((await anon.request(publicUrl)).status, 200);
    // Legacy editors trigger withdrawal too, even when they do not know about publication.
    await db.meeting.update({
      where: { id },
      data: { description: "Unreviewed legacy edit" },
    });
    draft = (await action(leader, "listClubCampusEvents", c.clubId)).find(
      (e) => e.id === id,
    );
    assert.equal(draft.status, "DRAFT");
    assert.equal((await anon.request(publicUrl)).status, 404);
    await command("SUBMIT");
    await action(admin, "reviewCampusEvent", {
      eventId: id,
      revision: draft.revision,
      approved: true,
    });
    draft = await action(leader, "saveCampusEvent", {
      ...base,
      id,
      revision: draft.revision,
      rsvpDeadline: new Date(Date.now() - 60000).toISOString(),
      useTemplate: true,
    });
    await command("SUBMIT");
    await action(admin, "reviewCampusEvent", {
      eventId: id,
      revision: draft.revision,
      approved: true,
    });
    await assert.rejects(
      action(student, "setCampusEventRsvp", { eventId: id, going: true }),
    );
    await command("CANCEL");
    await invisible();
    const audits = await db.auditLog.findMany({
      where: { targetId: id },
      select: { action: true },
    });
    for (const expected of [
      "event.draft.save",
      "event.submitted",
      "event.pending",
      "event.rejected",
      "event.approved",
      "event.published",
      "event.flyer.upload",
      "event.rsvp.create",
      "event.rsvp.cancel",
      "event.cancelled",
    ])
      assert.ok(
        audits.some((a) => a.action === expected),
        expected,
      );
    // Independent connections test SQL guard serialization, not an in-memory promise queue.
    const race = await db.meeting.create({
      data: {
        clubId: c.clubId,
        title: "SQL concurrency",
        description: "Fixture",
        date: start,
        endDate: end,
        location: "Hall",
        audience: "RECRUITMENT",
        isPublic: true,
        publication: {
          create: {
            status: "PUBLISHED",
            capacity: 1,
            approvedRevision: 0,
            reviewedAt: new Date(),
            reviewedBy: c.identities.admin.id,
            publishedAt: new Date(),
          },
        },
      },
    });
    const clients = [
      new PrismaClient({ datasourceUrl: c.status.DB_URL }),
      new PrismaClient({ datasourceUrl: c.status.DB_URL }),
    ];
    try {
      const results = await Promise.allSettled(
        clients.map((client, i) =>
          client.eventRsvp.create({
            data: {
              eventId: race.id,
              userId: c.identities[i ? "outsider" : "student"].id,
            },
          }),
        ),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        await db.eventRsvp.count({ where: { eventId: race.id } }),
        1,
      );
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
    }
    // Public browser fixtures remain explicitly approved; no fake rows in the production UI.
    for (const [i, title] of [
      "Consulting Night",
      "Environmental Action Fair",
      "Open House",
      "Bake Sale for a Cause",
      "Speaker Event",
      "Dance Team Auditions",
      "Financial Literacy Workshop",
      "Service Social",
    ].entries()) {
      const date = new Date(Date.now() + (i + 1) * 86400000);
      await db.meeting.create({
        data: {
          clubId: c.clubId,
          title,
          description:
            "A disposable local event for visual and interaction verification. Meet your community and find your next possibility.",
          date,
          endDate: new Date(+date + 7200000),
          location: i % 2 ? "The Lawn" : "Newcomb Hall",
          audience: "RECRUITMENT",
          isPublic: true,
          publication: {
            create: {
              status: "PUBLISHED",
              category: [
                "Professional",
                "Service",
                "Academic",
                "Social",
                "Arts",
                "Sports",
              ][i % 6],
              template: ["academic", "sage", "navy", "orange"][i % 4],
              capacity: 150,
              approvedRevision: 0,
              reviewedAt: new Date(),
              reviewedBy: c.identities.admin.id,
              publishedAt: new Date(),
            },
          },
        },
      });
    }
    t.diagnostic(
      "Disposable local server actions, Auth MFA, storage bytes, SQL triggers, competing connections and public-consumer projections verified.",
    );
  },
);
