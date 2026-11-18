// Reads the git-ignored staging accounts file and signs a role in. Never prints a password or token.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { loadStagingEnv } = require("./guard.cjs");

function accounts(root) {
  const text = fs.readFileSync(path.join(root, "docs/mobile/STAGING_ACCOUNTS.local.md"), "utf8");
  const found = {};
  for (const line of text.split("\n")) {
    const cells = line.split("|").map(cell => cell.trim());
    if (cells.length >= 6 && /@virginia\.edu$/.test(cells[3])) found[cells[1]] = { email: cells[3], password: cells[4].replace(/^`|`$/g, "") };
  }
  return found;
}

/** @returns {Promise<{ token: string, userId: string, email: string }>} */
async function signIn(role) {
  const env = loadStagingEnv();
  const account = accounts(env.root)[role];
  if (!account) throw new Error(`No staging account for role ${role}. Run scripts/staging/seed.cjs.`);
  const client = createClient(env.supabaseUrl, env.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(account);
  if (error || !data.session) throw new Error(`Staging sign-in failed for ${role}.`);
  return { token: data.session.access_token, userId: data.user.id, email: account.email };
}

module.exports = { accounts, signIn };
