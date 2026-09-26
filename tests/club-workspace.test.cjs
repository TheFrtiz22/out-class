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
const clubId = "00000000-0000-4000-8000-000000000001";
test("workspace navigation follows explicit capabilities and never changes identity permissions", () => {
  const { clubWorkspaceSections, recruitmentTools } = load(
    "lib/club-workspace.ts",
  );
  assert.deepEqual(clubWorkspaceSections(null), []);
  assert.deepEqual(clubWorkspaceSections({ permissions: [] }), [
    "overview",
    "meetings",
    "tasks",
  ]);
  assert.deepEqual(clubWorkspaceSections({ isOwner: true }), [
    "overview",
    "members",
    "meetings",
    "tasks",
    "recruitment",
    "settings",
  ]);
  assert.deepEqual(clubWorkspaceSections({ permissions: ["members.manage"] }), [
    "overview",
    "members",
    "meetings",
    "tasks",
  ]);
  assert.deepEqual(clubWorkspaceSections({ permissions: ["club.settings"] }), [
    "overview",
    "meetings",
    "tasks",
    "settings",
  ]);
  assert.deepEqual(
    recruitmentTools({ permissions: ["interviews.manage"] }).map((t) => t.id),
    ["kits"],
  );
  assert.deepEqual(
    recruitmentTools({ permissions: ["applications.review"] }).map((t) => t.id),
    ["applicants", "interviews"],
  );
  assert.deepEqual(
    recruitmentTools({ permissions: ["recruitment.manage"] }).map((t) => t.id),
    ["rounds"],
  );
  assert.deepEqual(recruitmentTools({ permissions: ["decisions.vote"] }), []);
});
function setup(permissions = [], isOwner = false) {
  const queries = {};
  let denied = false;
  const prisma = {
    club: {
      findUniqueOrThrow: async ({ where, select }) => {
        assert.equal(where.id, clubId);
        assert.equal(select.members, undefined);
        return { id: clubId, name: "Club", tagline: "" };
      },
    },
    meeting: {
      findFirst: async (args) => {
        queries.meeting = args;
        return null;
      },
    },
    taskAssignment: {
      findMany: async (args) => {
        queries.work = args;
        return [];
      },
      count: async (args) => {
        queries.review = args;
        return 2;
      },
    },
    application: {
      groupBy: async (args) => {
        queries.recruitment = args;
        return [{ status: "SUBMITTED", _count: { _all: 3 } }];
      },
    },
    pipelineRound: {
      findMany: async (args) => {
        queries.rounds = args;
        return [];
      },
    },
  };
  const auth = {
    requireClubMembership: async (id) => {
      if (denied || id !== clubId) throw Error("Denied");
      return { membership: { id: "member", permissions, isOwner } };
    },
    requireClubPermission: async (id, required) => {
      if (
        denied ||
        id !== clubId ||
        (!isOwner && !required.every((p) => permissions.includes(p)))
      )
        throw Error("Denied");
      return {};
    },
  };
  return {
    api: load("actions/club-overview.ts", {
      "@/utils/prisma": { prisma },
      "@/utils/auth": auth,
    }),
    queries,
    revoke: () => {
      denied = true;
    },
  };
}
test("member overview reads personal outstanding work and sends no recruitment or club submission counts", async () => {
  const h = setup(),
    result = await h.api.getClubWorkspaceOverview(clubId);
  assert.equal(result.awaitingReview, null);
  assert.equal(result.recruitment, null);
  assert.equal(h.queries.review, undefined);
  assert.equal(h.queries.recruitment, undefined);
  assert.equal(h.queries.work.where.memberId, "member");
  assert.equal(h.queries.work.where.task.clubId, clubId);
  assert.equal(h.queries.work.where.submittedAt, null);
  assert.equal(h.queries.meeting.where.clubId, clubId);
  assert.ok(h.queries.meeting.where.date.gte instanceof Date);
  h.revoke();
  await assert.rejects(h.api.getClubWorkspaceOverview(clubId), /Denied/);
});
test("review-only overview restricts recruitment counts to anonymous rounds and round settings require their own capability", async () => {
  const h = setup(["applications.review"]),
    result = await h.api.getClubWorkspaceOverview(clubId);
  assert.deepEqual(h.queries.recruitment.where.round, {
    anonymousReview: true,
  });
  assert.deepEqual(result.recruitment, [{ status: "SUBMITTED", count: 3 }]);
  assert.equal(h.queries.recruitment.include, undefined);
  await assert.rejects(h.api.getWorkspaceRounds(clubId), /Denied/);
  const owner = setup([], true);
  await owner.api.getClubWorkspaceOverview(clubId);
  assert.equal(owner.queries.recruitment.where.round, undefined);
  assert.equal(owner.queries.review.where.task.clubId, clubId);
  await owner.api.getWorkspaceRounds(clubId);
  assert.deepEqual(owner.queries.rounds.select, {
    id: true,
    name: true,
    anonymousReview: true,
  });
});

test("product modes preserve scoped URLs and limit manager destinations by capability", () => {
  const { managerNavigation, personalMode } = load("lib/product-navigation.ts");
  const ids = (permissions, mode) => managerNavigation({ permissions }, clubId, mode).map(item => item.id);
  assert.deepEqual(ids(["members.manage"], "club"), ["overview", "meetings", "tasks", "members"]);
  assert.deepEqual(ids(["applications.review"], "recruiting"), ["overview", "applicants", "interviews", "decisions"]);
  assert.deepEqual(ids(["interviews.manage"], "recruiting"), ["overview", "interviews"]);
  assert.deepEqual(ids(["recruitment.manage"], "recruiting"), ["overview", "rounds", "rules"]);
  const owner = managerNavigation({ isOwner: true }, clubId, "recruiting");
  assert.ok(owner.find(item => item.id === "rules").preview);
  assert.ok(owner.find(item => item.id === "rounds").quiet);
  for (const item of owner) {
    const url = new URL(item.href, "https://outclass.test");
    assert.equal(url.pathname, `/club/${clubId}/workspace`);
    assert.equal(url.searchParams.get("section"), "recruitment");
    assert.equal(url.searchParams.get("tool"), item.id);
  }
  assert.equal(personalMode("interviews"), "applications");
  assert.equal(personalMode("tasks"), "clubs");
  assert.equal(personalMode("categories"), "explore");
});
