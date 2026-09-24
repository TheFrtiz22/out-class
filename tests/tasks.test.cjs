const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript");
function load(file, mocks = {}) {
  const mod = { exports: {} };
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
          ? load(n.replace("@/", "") + ".ts")
          : require(n),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clubId = uuid(1),
  taskId = uuid(2),
  assignmentId = uuid(3),
  memberId = uuid(4),
  fileId = uuid(5);
const rules = load("lib/tasks.ts");
function setup() {
  let actor = "student",
    current = true,
    manager = false,
    lastQuery,
    creates = [],
    audits = [],
    downloadCalls = 0,
    privateBucket = true,
    validObject = true,
    files = [];
  const member = {
    id: memberId,
    clubId,
    userId: "student",
    isOwner: false,
    permissions: [],
    groups: ["Research", "Presentations"],
    cohort: "Fall 2026",
    role: "GENERAL_MEMBER",
    user: {
      id: "student",
      email: "sample@virginia.edu",
      studentProfile: {
        firstName: "Sample",
        lastName: "Member",
        gradYear: 2028,
      },
    },
  };
  const task = {
    id: taskId,
    clubId,
    kind: "TASK",
    status: "OPEN",
    requirements: ["TEXT"],
    revision: 0,
    audience: rules.taskAudienceSchema.parse({ everyone: true }),
  };
  const assignment = {
    id: assignmentId,
    memberId,
    userId: "student",
    member,
    task,
    taskId,
    revision: 0,
    reviewedAt: null,
    submittedAt: null,
    text: "",
    link: "",
  };
  const tx = {
    $queryRaw: async () => [],
    clubMember: {
      findUnique: async () =>
        current ? { ...member, isOwner: manager } : null,
      findMany: async () => [
        member,
        {
          ...member,
          id: uuid(6),
          groups: ["Research"],
          user: { ...member.user, id: "second" },
        },
      ],
      updateMany: async () => ({ count: 1 }),
    },
    clubTask: {
      findMany: async (args) => {
        lastQuery = args;
        return [];
      },
      findFirst: async ({ where }) => (where.id === taskId ? task : null),
      findUniqueOrThrow: async () => task,
      create: async ({ data }) => {
        creates.push(data);
        return { id: taskId, ...data };
      },
      updateMany: async ({ where, data }) => {
        if (where.id !== taskId || where.revision !== task.revision)
          return { count: 0 };
        Object.assign(task, data, { revision: task.revision + 1 });
        return { count: 1 };
      },
    },
    taskAssignment: {
      findUnique: async ({ where }) =>
        where.id === assignmentId ? assignment : null,
      updateMany: async ({ where, data }) => {
        if (
          (where.revision !== undefined &&
            where.revision !== assignment.revision) ||
          (where.reviewedAt === null && assignment.reviewedAt) ||
          (where.submittedAt?.not === null && !assignment.submittedAt) ||
          (where.member?.userId && where.member.userId !== actor)
        )
          return { count: 0 };
        Object.assign(assignment, data, {
          revision: data.revision
            ? assignment.revision + 1
            : assignment.revision,
        });
        return { count: 1 };
      },
    },
    taskFile: {
      findMany: async ({ where }) =>
        files.filter(
          (f) =>
            f.assignmentId === where.assignmentId && where.id.in.includes(f.id),
        ),
      findUnique: async ({ where }) =>
        files.find((f) => f.id === where.id)
          ? { ...files.find((f) => f.id === where.id), assignment }
          : null,
      updateMany: async ({ where, data }) => {
        files
          .filter(
            (f) =>
              f.assignmentId === where.assignmentId &&
              (!where.id || where.id.in.includes(f.id)),
          )
          .forEach((f) => Object.assign(f, data));
        return { count: 1 };
      },
      count: async () => 0,
      create: async ({ data }) => {
        const file = { id: fileId, ...data };
        files.push(file);
        return file;
      },
      delete: async () => {},
    },
    auditLog: {
      create: async ({ data }) => {
        audits.push(data);
      },
    },
  };
  const bucket = {
    list: async () => ({
      data: validObject
        ? files.map((f) => ({
            name: f.path.split("/").pop(),
            metadata: { size: f.size, mimetype: f.mime },
          }))
        : [],
      error: null,
    }),
    createSignedUploadUrl: async (path, options) => {
      assert.equal(options.upsert, false);
      return {
        data: { signedUrl: "https://storage.test/upload" },
        error: null,
      };
    },
    createSignedUrl: async (path, ttl, options) => {
      assert.equal(ttl, 60);
      assert.equal(options.download, "work.pdf");
      downloadCalls++;
      return {
        data: { signedUrl: "https://storage.test/download" },
        error: null,
      };
    },
  };
  const auth = {
    requireAuth: async () => ({ user: { id: actor } }),
    requireClubMembership: async () => {
      if (!current) throw Error("Denied");
      return { membership: { ...member, isOwner: manager } };
    },
    requireClubPermission: async (id, permissions) => {
      if (id !== clubId || !current || !manager) throw Error("Denied");
      return { user: { id: actor }, membership: { ...member, isOwner: true } };
    },
  };
  const api = load("actions/tasks.ts", {
    "@/utils/prisma": { prisma: { ...tx, $transaction: async (fn) => fn(tx) } },
    "@/utils/auth": auth,
    "@supabase/supabase-js": {
      createClient: () => ({
        storage: {
          getBucket: async () => ({
            data: { public: !privateBucket },
            error: null,
          }),
          from: () => bucket,
        },
      }),
    },
  });
  return {
    api,
    task,
    assignment,
    member,
    tx,
    creates,
    audits,
    files: () => files,
    setFiles: (f) => {
      files = f;
    },
    manager: () => {
      manager = true;
    },
    outsider: () => {
      actor = "outsider";
    },
    revoke: () => {
      current = false;
    },
    privateBucket: (b) => {
      privateBucket = b;
    },
    validObject: (b) => {
      validObject = b;
    },
    lastQuery: () => lastQuery,
    downloads: () => downloadCalls,
  };
}
test("audiences union groups, cohorts, individuals, roles and graduation year without duplicating recipients", async () => {
  const h = setup();
  h.manager();
  await h.api.saveTask({
    clubId,
    title: "Research brief",
    audience: { groups: ["Research"], members: [memberId], years: [2028] },
  });
  assert.equal(h.creates[0].assignments.create.length, 2);
  assert.equal(
    new Set(h.creates[0].assignments.create.map((a) => a.memberId)).size,
    2,
  );
  assert.deepEqual(h.creates[0].assignments.create[0], {
    memberId,
    userId: "student",
  });
  assert.equal(h.audits[0].action, "club.task.save");
  for (const audience of [
    { everyone: true },
    { members: [memberId] },
    { groups: ["Presentations"] },
    { cohorts: ["Fall 2026"] },
    { years: [2028] },
    { roles: ["GENERAL_MEMBER"] },
  ])
    assert.ok(
      rules.matchesTaskAudience(
        { ...h.member, gradYear: 2028 },
        rules.taskAudienceSchema.parse(audience),
      ),
    );
  assert.equal(
    rules.matchesTaskAudience(
      { ...h.member, gradYear: null },
      rules.taskAudienceSchema.parse({ years: [2028] }),
    ),
    false,
  );
});
test("task creation denies non-managers, foreign assignees/projects, empty audiences, and stale changes", async () => {
  const h = setup(),
    input = { clubId, title: "Brief", audience: { everyone: true } };
  await assert.rejects(h.api.saveTask(input), /Denied/);
  h.manager();
  await assert.rejects(
    h.api.saveTask({ ...input, audience: { members: [uuid(99)] } }),
    /no longer a member/,
  );
  await assert.rejects(
    h.api.saveTask({ ...input, audience: { groups: ["Missing"] } }),
    /at least one/,
  );
  await assert.rejects(
    h.api.saveTask({ ...input, projectId: uuid(99) }),
    /project/,
  );
  await assert.rejects(
    h.api.saveTask({ ...input, id: taskId, revision: 99 }),
    /changed/,
  );
  await assert.rejects(
    h.api.saveTask({
      ...input,
      id: taskId,
      audience: { groups: ["Research"] },
    }),
    /Audience is fixed/,
  );
  const reordered = Object.fromEntries(
    Object.entries(h.task.audience).reverse(),
  );
  h.task.audience = reordered;
  await h.api.saveTask({ ...input, id: taskId });
  assert.equal(h.task.revision, 1);
});
test("member reads scope both tasks and recipients; manager reads require current membership", async () => {
  const h = setup();
  const member = await h.api.getTaskWorkspace(clubId);
  assert.deepEqual(member.members, []);
  assert.deepEqual(h.lastQuery().where.assignments, { some: { memberId } });
  assert.deepEqual(h.lastQuery().include.assignments.where, { memberId });
  h.manager();
  await h.api.getTaskWorkspace(clubId);
  assert.equal(h.lastQuery().where.assignments, undefined);
  h.revoke();
  await assert.rejects(h.api.getTaskWorkspace(clubId), /Denied/);
});
test("submissions enforce ownership, current membership, formats, revision and closed/reviewed status", async () => {
  const input = {
    assignmentId,
    revision: 0,
    text: "Completed research",
    link: "",
    fileIds: [],
  };
  for (const setupCase of [
    (h) => h.outsider(),
    (h) => h.revoke(),
    (h) => {
      h.task.status = "DONE";
    },
    (h) => {
      h.assignment.reviewedAt = new Date();
    },
    (h) => {
      h.assignment.revision = 2;
    },
    (h) => {
      h.task.requirements = ["LINK"];
    },
    (h) => {
      h.task.kind = "PROJECT";
    },
  ]) {
    const h = setup();
    setupCase(h);
    await assert.rejects(h.api.submitTask(input));
    assert.equal(h.audits.length, 0);
  }
  const h = setup();
  await h.api.submitTask(input);
  assert.ok(h.assignment.submittedAt instanceof Date);
  assert.equal(h.assignment.text, input.text);
  assert.equal(h.assignment.revision, 1);
  assert.equal(h.audits[0].action, "club.task.submit");
  await assert.rejects(h.api.submitTask(input), /changed/);
  await assert.rejects(
    h.api.submitTask({ ...input, revision: 1, link: "javascript:alert(1)" }),
  );
});
test("review requires a submission, supports reopen, and prevents stale overwrite", async () => {
  const h = setup(),
    input = {
      assignmentId,
      revision: 0,
      feedback: "Clear analysis.",
      reopen: false,
    };
  await assert.rejects(h.api.reviewTask(input), /Denied/);
  h.manager();
  await assert.rejects(h.api.reviewTask(input), /not yet submitted/);
  h.assignment.submittedAt = new Date();
  await h.api.reviewTask(input);
  assert.ok(h.assignment.reviewedAt);
  assert.equal(h.assignment.feedback, input.feedback);
  await assert.rejects(h.api.reviewTask(input), /changed/);
  await h.api.reviewTask({ ...input, revision: 1, reopen: true });
  assert.equal(h.assignment.reviewedAt, null);
});
test("late status comes from deadline and submission time rather than a score", () => {
  const task = { dueAt: "2026-09-24T12:00:00Z" };
  assert.equal(
    rules.taskState(
      task,
      { submittedAt: null, reviewedAt: null },
      +new Date("2026-09-25"),
    ),
    "Overdue",
  );
  assert.equal(
    rules.taskState(task, { submittedAt: "2026-09-23", reviewedAt: null }),
    "Submitted",
  );
  assert.equal(
    rules.taskState(task, { submittedAt: "2026-09-25", reviewedAt: null }),
    "Submitted late",
  );
  assert.equal(
    rules.taskState(task, {
      submittedAt: "2026-09-25",
      reviewedAt: "2026-09-26",
    }),
    "Reviewed",
  );
});
test("private uploads validate ownership, file size/type/name, storage metadata, and signed download access", async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://storage.test";
  process.env.SUPABASE_SECRET_KEY = "test-only";
  try {
    const h = setup(),
      input = {
        assignmentId,
        name: "work.pdf",
        size: 200,
        mime: "application/pdf",
      };
    await assert.rejects(
      h.api.uploadTaskFile({ ...input, name: "../work.pdf" }),
    );
    await assert.rejects(
      h.api.uploadTaskFile({ ...input, size: 11 * 1024 * 1024 }),
    );
    await assert.rejects(h.api.uploadTaskFile({ ...input, mime: "text/html" }));
    h.privateBucket(false);
    await assert.rejects(h.api.uploadTaskFile(input), /Private task storage/);
    h.privateBucket(true);
    const upload = await h.api.uploadTaskFile(input);
    assert.equal(upload.id, fileId);
    assert.ok(!h.files()[0].path.includes(input.name));
    h.validObject(false);
    await assert.rejects(
      h.api.submitTask({
        assignmentId,
        revision: 0,
        text: "Work",
        link: "",
        fileIds: [fileId],
      }),
      /incomplete or invalid/,
    );
    await assert.rejects(h.api.downloadTaskFile(fileId), /unavailable/);
    h.validObject(true);
    await h.api.submitTask({
      assignmentId,
      revision: 0,
      text: "Work",
      link: "",
      fileIds: [fileId],
    });
    assert.equal(
      (await h.api.downloadTaskFile(fileId)).url,
      "https://storage.test/download",
    );
    h.outsider();
    await assert.rejects(h.api.downloadTaskFile(fileId), /unavailable/);
    assert.equal(h.downloads(), 1);
    h.manager();
    await h.api.downloadTaskFile(fileId);
    h.revoke();
    await assert.rejects(h.api.downloadTaskFile(fileId), /unavailable/);
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
