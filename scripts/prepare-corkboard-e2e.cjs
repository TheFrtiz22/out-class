// Only provisions a separate disposable LOCAL project. Does not load application .env.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawnSync } = require("node:child_process"),
  { randomUUID } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js"),
  { PrismaClient } = require("@prisma/client");
const project = process.argv.includes("--admin-session") ? "outclass-admin-session-e2e" : "outclass-corkboard-e2e", appPort = project === "outclass-admin-session-e2e" ? 3109 : 3108, portOffset = project === "outclass-admin-session-e2e" ? 6000 : 2000;
const root = path.join(os.tmpdir(), project),
  repo = path.resolve(__dirname, "..");
function run(binary, args, env = process.env) {
  const r = spawnSync(binary, args, { cwd: repo, env, encoding: "utf8" });
  if (r.status !== 0) throw Error(`${binary} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}
(async () => {
  fs.mkdirSync(path.join(root, "supabase/templates"), { recursive: true });
  let config = fs
    .readFileSync("supabase/config.toml", "utf8")
    .replace(
      'project_id = "out-class"',
      `project_id = "${project}"`,
    );
  for (const port of [54321, 54322, 54323, 54324, 54325, 54327, 54320, 54329])
    config = config.replaceAll(String(port), String(port + portOffset));
  config = config.replaceAll("http://127.0.0.1:3000", `http://127.0.0.1:${appPort}`);
  const start = config.indexOf("[auth.mfa.totp]"),
    end = config.indexOf("[auth.mfa.phone]", start);
  config =
    config.slice(0, start) +
    config
      .slice(start, end)
      .replace("enroll_enabled = false", "enroll_enabled = true")
      .replace("verify_enabled = false", "verify_enabled = true") +
    config.slice(end);
  if (!config.split("\n").includes(`project_id = "${project}"`))
    throw Error("Non-test project rejected");
  fs.writeFileSync(path.join(root, "supabase/config.toml"), config);
  for (const name of fs.readdirSync("supabase/templates").filter(name => name.endsWith(".html")))
    fs.copyFileSync(
      path.join("supabase/templates", name),
      path.join(root, "supabase/templates", name),
    );
  console.log(
    `Starting disposable ${project} project on its dedicated localhost ports.`,
  );
  const out = run("supabase", [
    "start",
    "--workdir",
    root,
    "-x",
    "studio,edge-runtime,analytics,vector,imgproxy",
  ]);
  fs.writeFileSync(path.join(root, "start.log"), out);
  const status = JSON.parse(
    run("supabase", ["status", "--workdir", root, "-o", "json"]),
  );
  if (
    !(["127.0.0.1", "localhost"].includes(new URL(status.DB_URL).hostname) && new URL(status.DB_URL).port === String(54322 + portOffset))
  )
    throw Error("Non-local database rejected");
  const env = {
    ...process.env,
    DATABASE_URL: status.DB_URL,
    POSTGRES_PRISMA_URL: status.DB_URL,
    POSTGRES_URL_NON_POOLING: status.DB_URL,
  };
  fs.writeFileSync(
    path.join(root, "migrate.log"),
    run(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      env,
    ),
  );
  const existingConfig = path.join(root, "config.json");
  if (fs.existsSync(existingConfig)) {
    const old = JSON.parse(fs.readFileSync(existingConfig));
    if (
      old.projectId !== project ||
      old.status.DB_URL !== status.DB_URL
    )
      throw Error("Unexpected local fixture configuration");
    console.log("Reusing existing disposable Corkboard fixture identities.");
    return;
  }
  const adminAuth = createClient(
      status.API_URL,
      status.SECRET_KEY || status.SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    ),
    db = new PrismaClient({ datasourceUrl: status.DB_URL });
  const identities = {};
  for (const role of ["leader", "admin", "student", "outsider"]) {
    const email = `corkboard-${role}@virginia.edu`,
      password = `Local-${randomUUID()}!`;
    const users = await adminAuth.auth.admin.listUsers();
    const old = users.data.users.find((u) => u.email === email);
    if (old) {
      await db.user.deleteMany({ where: { id: old.id } });
      await adminAuth.auth.admin.deleteUser(old.id);
    }
    const { data, error } = await adminAuth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    const id = data.user.id;
    await db.user.create({ data: { id, email } });
    await db.studentProfile.create({
      data: {
        userId: id,
        firstName: role[0].toUpperCase() + role.slice(1),
        lastName: "Fixture",
        computingId: `cb-${role}`,
        major: "Undeclared",
        gradYear: 2028,
      },
    });
    identities[role] = { id, email, password };
  }
  await db.platformAdmin.create({ data: { userId: identities.admin.id } });
  const club = await db.club.create({
    data: {
      name: "Corkboard Test Club",
      slug: "corkboard-test-club",
      tagline: "Isolated fixture",
      description: "Disposable local browser and integration fixtures",
      color: "#102e4a",
      category: "Academic",
    },
  });
  await db.clubMember.create({
    data: {
      clubId: club.id,
      userId: identities.leader.id,
      isOwner: true,
      permissions: ["meetings.manage", "meetings.attendance"],
    },
  });
  const second = await db.club.create({
    data: {
      name: "Other Test Club",
      slug: "other-corkboard-test",
      tagline: "Fixture",
      description: "Ownership negative test",
      color: "#102e4a",
      category: "Social",
    },
  });
  const login = createClient(
    status.API_URL,
    status.PUBLISHABLE_KEY || status.ANON_KEY,
    { auth: { persistSession: false } },
  );
  const signin = await login.auth.signInWithPassword(identities.admin);
  if (signin.error) throw signin.error;
  const factor = await login.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Corkboard local verification",
  });
  if (factor.error) throw factor.error;
  identities.admin.totpSecret = factor.data.totp.secret;
  identities.admin.factorId = factor.data.id;
  const settings = {
    projectId: project,
    appUrl: `http://127.0.0.1:${appPort}`,
    buildDir: path.join(repo, ".next-publish"),
    status,
    identities,
    clubId: club.id,
    otherClubId: second.id,
  };
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify(settings), {
    mode: 0o600,
  });
  await db.$disconnect();
  console.log(
    `All migrations deployed to disposable local database. Test config: ${path.join(root, "config.json")}`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
