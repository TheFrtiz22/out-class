// Starts a fresh draft for the staging student at a club with open applications they have not applied to.
// Prints the new application id. Used before recording the apply-to-submit flow.
"use strict";
const { signIn } = require("./accounts.cjs");
const base = "http://localhost:3000/api/mobile/v1/";
(async () => {
  const { token } = await signIn("student");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const get = async name => (await (await fetch(base + name, { headers })).json()).data;
  const [directory, mine] = await Promise.all([get("explore.directory"), get("applications")]);
  const applied = new Set(mine.map(application => application.clubId));
  for (const club of directory.clubs.filter(item => item.applicationAvailable && item.claimed && !applied.has(item.id))) {
    const started = (await (await fetch(base + "applications.start", { method: "POST", headers, body: JSON.stringify({ clubId: club.id }) })).json()).data;
    if (started?.applicationId) { process.stdout.write(started.applicationId); return; }
  }
  console.error("no club available"); process.exit(1);
})();
