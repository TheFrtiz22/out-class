// Acts as a second staging account in a live voting room, through the mobile API, so a flow can drive
// the host in the app while another member joins and votes. Staging only (accounts.cjs is guarded).
// Run: node scripts/staging/vote-as.cjs <role> <clubId> <sessionId> <join|vote|state> [ACCEPT|HOLD|REJECT]
"use strict";
const { randomUUID } = require("node:crypto");
const { signIn } = require("./accounts.cjs");

const base = process.env.MOBILE_API_URL || "http://localhost:3000";

(async () => {
  const [role, clubId, sessionId, action = "state", choice = "ACCEPT"] = process.argv.slice(2);
  if (!role || !clubId || !sessionId) throw new Error("Usage: vote-as.cjs <role> <clubId> <sessionId> <join|vote|state> [choice]");
  const { token } = await signIn(role);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const scope = { clubId, sessionId };
  const get = async (operation, input) => {
    const url = new URL(`/api/mobile/v1/${operation}`, base);
    url.searchParams.set("input", JSON.stringify(input));
    const response = await fetch(url, { headers });
    return { status: response.status, body: await response.json() };
  };
  const post = async (operation, input) => {
    const response = await fetch(new URL(`/api/mobile/v1/${operation}`, base), { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return { status: response.status, body: await response.json() };
  };
  const room = async () => {
    const { status, body } = await get("voting.room", scope);
    if (!body.data) throw new Error(`voting.room ${status}: ${body.error?.message}`);
    return body.data;
  };
  const summary = snapshot => {
    const pass = snapshot.history.find(p => p.number === snapshot.passNumber);
    const entry = pass?.candidates.find(c => c.applicationId === snapshot.currentApplicantId);
    return {
      status: snapshot.status, revision: snapshot.revision, pass: snapshot.passNumber, position: entry ? entry.position + 1 : null, of: pass?.candidates.length ?? null,
      ballot: entry?.ballotState ?? null, ownBallot: entry?.ownBallot?.choice ?? null, participation: snapshot.participation, joinedSelf: snapshot.joinedSelf,
      undecided: snapshot.outcomes.filter(o => o.outcome === "UNREVIEWED" || o.outcome === "HOLD").length, finalizedAt: snapshot.finalizedAt,
    };
  };

  if (action === "join") {
    const info = await get("voting.joinInfo", scope);
    console.log("joinInfo", info.status, info.body.data?.status ?? info.body.error?.message);
    if (info.body.data?.status === "READY") {
      const joined = await post("voting.join", scope);
      console.log("join", joined.status, JSON.stringify(joined.body.data ?? joined.body.error));
    }
  } else if (action === "vote") {
    const snapshot = await room();
    const entry = snapshot.history.find(p => p.number === snapshot.passNumber)?.candidates.find(c => c.applicationId === snapshot.currentApplicantId);
    if (!entry) throw new Error("No applicant is on screen.");
    const cast = await post("voting.ballot", { ...scope, requestId: randomUUID(), passNumber: snapshot.passNumber, applicationId: snapshot.currentApplicantId, choice, ballotRevision: entry.ownBallot?.revision ?? null });
    console.log("ballot", cast.status, JSON.stringify(cast.body.data ?? cast.body.error));
  }
  console.log("state", JSON.stringify(summary(await room())));
})().catch(error => { console.error(error.message); process.exit(1); });
