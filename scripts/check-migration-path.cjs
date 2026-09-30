const fs = require("node:fs")
const path = require("node:path")
const root = path.resolve(__dirname, "..")
const active = path.join(root, "supabase/migrations")
if (fs.existsSync(active) && fs.readdirSync(active).some(name => name.endsWith(".sql"))) {
  throw new Error("Conflicting Supabase migration history is active. Follow docs/database-deployment.md; do not deploy both histories.")
}
const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8")
if (!/\[db\.migrations\][\s\S]*?enabled\s*=\s*false/.test(config.split("[db.seed]")[0]))
  throw new Error("Supabase migrations must stay disabled; Prisma is authoritative.")
console.log("Prisma is the sole application migration source. This repository check does not verify deployed schema drift; follow docs/database-deployment.md before deployment.")
