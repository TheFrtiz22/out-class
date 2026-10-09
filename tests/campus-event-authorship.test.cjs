const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => name in mocks ? mocks[name]
      : name.startsWith("@/") ? load(name.slice(2) + ".ts", mocks)
        : require(name), mod, mod.exports,
  );
  return mod.exports;
}

const eventId = "00000000-0000-4000-8000-000000000001";
const clubId = "00000000-0000-4000-8000-000000000002";
function harness() {
  let actor = "leader", authorized = true, tick = 0, writes = 0;
  const logs = [];
  const editor = {
    id: eventId, clubId, title: "Campus night", description: "Meet our members",
    date: "2099-10-16T23:00:00Z", endDate: "2099-10-17T01:00:00Z",
    location: "Hall", category: "Academic", contact: "",
    rsvpEnabled: true, rsvpRequired: false, capacity: 10,
    rsvpDeadline: null, template: "academic", useTemplate: true,
  };
  const event = {
    ...editor, date: new Date(editor.date), endDate: new Date(editor.endDate),
    revision: 0, isPublic: true, audience: "RECRUITMENT",
    club: { name: "Club" }, _count: { rsvps: 0 },
    publication: { ...editor, status: "DRAFT", submittedBy: null, flyerId: null },
  };
  const audit = (action, actorId = actor, targetId = eventId, createdAt) => {
    const row = { id: "audit-" + logs.length, action, actorId, targetId,
      createdAt: createdAt || new Date(1700000000000 + ++tick) };
    logs.push(row);
    return row;
  };
  const tx = {
    $queryRaw: async () => [],
    meeting: {
      findUnique: async () => event,
      findFirst: async () => event,
      update: async ({ data }) => {
        const { revision, ...fields } = data;
        Object.assign(event, fields);
        event.revision += revision.increment;
        // Model the existing Event withdrawal trigger, tested against SQL elsewhere.
        Object.assign(event.publication, { status: "DRAFT", approvedRevision: null, publishedAt: null });
        return event;
      },
    },
    meetingCheckInToken: { deleteMany: async () => ({ count: 0 }) },
    clubMember: { findUnique: async () => null },
    eventPublication: {
      upsert: async ({ update }) => Object.assign(event.publication, update),
      update: async ({ data }) => {
        writes++;
        return Object.assign(event.publication, data);
      },
    },
    auditLog: {
      create: async ({ data }) => audit(data.action, data.actorId, data.targetId),
      findFirst: async ({ where, orderBy }) => {
        const matches = logs.filter((row) => row.targetId === where.targetId
          && (!where.actorId || row.actorId === where.actorId)
          && (typeof where.action === "string" ? row.action === where.action : where.action.in.includes(row.action))
          && (!where.createdAt || row.createdAt >= where.createdAt.gte));
        if (orderBy) matches.sort((a, b) => b.createdAt - a.createdAt);
        return matches[0] || null;
      },
    },
  };
  const mocks = {
    "@/utils/prisma": { prisma: { $transaction: async (fn) => fn(tx) } },
    "@/utils/auth": { requireClubPermission: async () => ({ user: { id: actor } }) },
    "@/utils/platform-admin": { requirePlatformAdmin: async () => {
      if (!authorized) throw Error("Platform administrator access denied.");
      return { id: actor };
    } },
    "@/lib/demo/validate": { readDemoTemplate() {} },
    "next/cache": { revalidatePath() {}, revalidateTag() {} },
  };
  const api = load("actions/campus-events.ts", mocks);
  const platform = load("actions/platform-admin.ts", mocks);
  return {
    logs, event, audit,
    as(id) { actor = id; },
    denyAdmin() { authorized = false; },
    writes: () => writes,
    edit: () => api.saveCampusEvent({ ...editor, revision: event.revision }),
    legacyEdit: () => platform.changePlatformResource({
      kind: "meeting", id: eventId, clubId, title: "Legacy edited night",
      date: editor.date, location: "Hall", isPublic: true,
    }, "Correct the public event details."),
    submit: () => api.commandCampusEvent({ eventId, clubId, revision: event.revision, command: "SUBMIT" }),
    review: (approved = true) => api.reviewCampusEvent({ eventId, revision: event.revision, approved,
      ...(approved ? {} : { reason: "Please correct the event details." }) }),
  };
}

test("leader edits and submits; a different administrator can approve", async () => {
  const h = harness();
  await h.edit(); await h.submit(); h.as("admin-a");
  await h.review();
  assert.equal(h.event.publication.status, "PUBLISHED");
});

test("Corkboard save, flyer upload and submission authors cannot review their own work", async () => {
  for (const action of ["event.draft.save", "event.flyer.upload", "event.submitted", "meeting.save"]) {
    const h = harness();
    h.as("admin-a");
    if (action === "event.draft.save") await h.edit();
    else h.audit(action);
    h.as("leader"); await h.submit(); h.as("admin-a");
    const before = h.writes();
    await assert.rejects(h.review(), /cannot approve or reject/);
    await assert.rejects(h.review(false), /cannot approve or reject/);
    assert.equal(h.writes(), before);
    assert.equal(h.event.publication.status, "PENDING");
  }
});

test("real legacy platform editor records authorship and blocks that administrator after leader resubmission", async () => {
  const h = harness();
  await h.edit(); await h.submit(); h.as("admin-b"); await h.review();
  h.as("admin-a"); await h.legacyEdit();
  assert.equal(h.logs.at(-1).action, "platform.meeting.change");
  assert.equal(h.logs.at(-1).actorId, "admin-a");
  assert.equal(h.event.publication.status, "DRAFT");
  h.as("leader"); await h.submit(); h.as("admin-a");
  await assert.rejects(h.review(), /cannot approve or reject/);
  assert.equal(h.event.publication.status, "PENDING");
});

test("another administrator can approve legacy content edited by the first administrator", async () => {
  const h = harness();
  h.as("admin-a"); await h.legacyEdit();
  h.as("leader"); await h.submit(); h.as("admin-b"); await h.review();
  assert.equal(h.event.publication.reviewedBy, "admin-b");
});

test("unrelated actions, other events and authorship before independent publication do not block approval", async () => {
  const h = harness();
  h.as("admin-a"); await h.legacyEdit();
  h.as("leader"); await h.submit(); h.as("admin-b"); await h.review();
  h.as("admin-a");
  h.audit("platform.user.change"); h.audit("platform.meeting.change", "admin-a", "other-event");
  h.as("leader"); await h.edit(); await h.submit(); h.as("admin-a");
  await h.review();
  assert.equal(h.event.publication.status, "PUBLISHED");
});

test("resubmission retains unapproved authorship across rejection and starts after the last successful review", async () => {
  const h = harness();
  h.as("admin-a"); await h.edit();
  h.as("leader"); await h.submit(); h.as("admin-b"); await h.review(false);
  h.as("leader"); await h.submit(); h.as("admin-a");
  await assert.rejects(h.review(), /cannot approve or reject/);
  h.as("admin-b"); await h.review();
  h.as("leader"); await h.edit(); await h.submit(); h.as("admin-a"); await h.review();
  assert.equal(h.event.publication.status, "PUBLISHED");
  h.as("admin-b"); await h.legacyEdit();
  h.as("leader"); await h.submit(); h.as("admin-b");
  await assert.rejects(h.review(), /cannot approve or reject/);
});

test("timestamp ties retain authorship conservatively and server admin authorization still runs", async () => {
  const h = harness();
  const baseline = h.audit("event.published", "admin-b");
  h.audit("platform.meeting.change", "admin-a", eventId, baseline.createdAt);
  await h.submit(); h.as("admin-a");
  await assert.rejects(h.review(), /cannot approve or reject/);
  h.as("admin-c"); h.denyAdmin();
  const before = h.writes();
  await assert.rejects(h.review(), /administrator access denied/);
  assert.equal(h.writes(), before);
});
