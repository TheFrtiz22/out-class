// Prints a current check-in short code for the staging live meeting (issued as the staging leader).
"use strict";
const { signIn } = require("./accounts.cjs");
(async () => {
  const { token } = await signIn("leader");
  const response = await fetch("http://localhost:3000/api/mobile/v1/meetings.checkIn.issue", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ clubId: "253d3ff8-35eb-4619-81bf-c7c195bbf4fe", meetingId: "52fd84d2-ca4e-439c-b794-03ca91eca68b" }) });
  const body = await response.json();
  if (!body.data?.shortCode) { console.error("issue failed", response.status, body.error?.code); process.exit(1); }
  process.stdout.write(body.data.shortCode);
})();
