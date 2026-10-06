// Builds/starts the Corkboard verification app with ONLY dedicated local service overrides.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process");
const root = path.join(os.tmpdir(), "outclass-corkboard-e2e"),
  c = JSON.parse(fs.readFileSync(path.join(root, "config.json")));
if (
  c.projectId !== "outclass-corkboard-e2e" ||
  new URL(c.status.DB_URL).port !== "56322" ||
  new URL(c.status.API_URL).port !== "56321"
)
  throw Error("Dedicated local project required");
for (const [value, port] of [
  [c.status.DB_URL, "56322"],
  [c.status.API_URL, "56321"],
  [c.appUrl, "3108"],
]) {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== port)
    throw Error("Dedicated localhost services required");
}
const s = c.status,
  env = {
    ...process.env,
    DATABASE_URL: s.DB_URL,
    POSTGRES_PRISMA_URL: s.DB_URL,
    POSTGRES_URL: s.DB_URL,
    POSTGRES_URL_NON_POOLING: s.DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: s.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: s.ANON_KEY,
    SUPABASE_SECRET_KEY: s.SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: s.SERVICE_ROLE_KEY,
    OUTCLASS_PLATFORM_ADMIN_IDS: c.identities.admin.id,
    OUTCLASS_SITE_URL: c.appUrl,
    OUTCLASS_PUBLISH_BUILD: "1",
  };
const mode = process.argv[2] || "validate",
  args =
    mode === "start"
      ? [
          "node_modules/next/dist/bin/next",
          "start",
          "-p",
          "3108",
          "-H",
          "127.0.0.1",
        ]
      : ["node_modules/npm/bin/npm-cli.js", "run", mode];
const child = spawn(
  mode === "start" ? process.execPath : "npm",
  mode === "start" ? args : ["run", mode],
  { env, stdio: "inherit" },
);
child.on("exit", (code) => (process.exitCode = code));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
