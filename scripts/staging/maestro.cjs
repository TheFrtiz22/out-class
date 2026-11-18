// Runs Maestro flows against the simulator with the staging accounts passed as flow variables.
// Passwords come from the git-ignored accounts file and are never printed.
// Run: [MAESTRO_DEVICE=<simulator udid>] node scripts/staging/maestro.cjs <flow.yaml> [more maestro args]
"use strict";
const { spawnSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const { accounts } = require("./accounts.cjs");
const { loadStagingEnv } = require("./guard.cjs");

const env = loadStagingEnv();
const found = accounts(env.root);
const variables = [];
for (const [role, account] of Object.entries(found)) {
  variables.push("-e", `${role.toUpperCase()}_EMAIL=${account.email}`, "-e", `${role.toUpperCase()}_PASSWORD=${account.password}`);
}
const javaHome = process.env.JAVA_HOME || "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
const [flow, ...rest] = process.argv.slice(2);
const result = spawnSync(path.join(os.homedir(), ".maestro/bin/maestro"), [...(process.env.MAESTRO_DEVICE ? ["--device", process.env.MAESTRO_DEVICE] : []), "test", flow, ...variables, ...rest], {
  cwd: path.join(env.root, "mobile"), encoding: "utf8",
  env: { PATH: `${javaHome}/bin:${process.env.PATH}`, JAVA_HOME: javaHome, HOME: os.homedir(), MAESTRO_CLI_NO_ANALYTICS: "1", MAESTRO_DISABLE_UPDATE_CHECK: "true" },
});
const scrub = text => { let out = String(text || ""); for (const account of Object.values(found)) out = out.split(account.password).join("[password]"); return out; };
process.stdout.write(scrub(result.stdout)); process.stderr.write(scrub(result.stderr));
process.exit(result.status ?? 1);
