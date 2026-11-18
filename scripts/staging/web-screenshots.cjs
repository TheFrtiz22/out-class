// Phone-width reference screenshots of the web app for the native port (docs/mobile/reference/web-phone-reference.md).
// Staging only (scripts/staging/guard.cjs), against the dev server already running on localhost:3000.
// Signs in through the real /login form. Read-only: opens pages, sheets and menus; never submits, books, responds or saves.
// The one exception is the first-run tutorial, which is captured and then skipped the way a student would.
//
//   node scripts/staging/web-screenshots.cjs                      every role, every screen
//   node scripts/staging/web-screenshots.cjs --role=student       one role (student | alumni | leader)
//   node scripts/staging/web-screenshots.cjs --only='^1[3-9]'     screens whose "NN-name" matches the pattern
//   OC_SHOT_DUMP_DIR=/tmp/x …                                     also write each screen's visible text and controls
//   OC_SHOT_STATE_DIR=/tmp/x …                                    reuse a signed-in session between runs (keep it out of the repo)
// Never prints a password or token.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices } = require("playwright");
const { accounts } = require("./accounts.cjs");
const { loadStagingEnv } = require("./guard.cjs");

const ORIGIN = "http://localhost:3000";
const VIEWPORT = { width: 390, height: 844 };
const MAX_FULL_HEIGHT = 5400; // 5400 CSS px at 3x stays under Chromium's 16,384 px image limit
const LEADER_CLUB = "253d3ff8-35eb-4619-81bf-c7c195bbf4fe";
const LIVE_MEETING = "52fd84d2-ca4e-439c-b794-03ca91eca68b";
const VOTING_SESSION = "e89ed370-6e82-4b3d-a454-091e0b109207";

const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...rest] = arg.replace(/^--/, "").split("="); return [key, rest.join("=") || "true"]; }));
const only = args.only ? new RegExp(args.only) : null;
const env = loadStagingEnv();
const OUT = path.join(env.root, "docs/mobile/screenshots/web");
const DUMP = process.env.OC_SHOT_DUMP_DIR || "";
const STATE = process.env.OC_SHOT_STATE_DIR || "";
const SCALE = Number(process.env.OC_SHOT_SCALE || 3);
fs.mkdirSync(OUT, { recursive: true });
if (DUMP) fs.mkdirSync(DUMP, { recursive: true });

const results = [];

async function settle(page, extra = 900) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  // Pages with live updates never go idle, so this is bounded; skeletons are waited out separately.
  await page.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], .animate-pulse, [data-loading="true"], .oc-skeleton'), null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(extra);
}
async function go(page, route, extra) {
  for (let attempt = 0; ; attempt++) {
    try { await page.goto(ORIGIN + route, { waitUntil: "domcontentloaded", timeout: 180000 }); break; }
    catch (error) { if (attempt >= 2) throw error; await page.waitForTimeout(8000); }
  }
  await settle(page, extra);
}
async function dump(page, name) {
  if (!DUMP) return;
  const text = await page.locator("body").innerText().catch(() => "");
  const links = await page.locator("a[href]").evaluateAll(els => [...new Set(els.map(e => `${e.getAttribute("href")}  [${e.getAttribute("aria-label") || e.innerText.replace(/\s+/g, " ").slice(0, 70)}]`))]).catch(() => []);
  const controls = await page.locator("button,[role=tab],[role=button],[role=menuitem],[role=option],[role=switch],[role=checkbox],[role=radio],select,input,textarea").evaluateAll(els => els.filter(e => e.offsetParent !== null).map(e => {
    const state = ["aria-pressed", "aria-selected", "aria-expanded", "aria-checked", "aria-current", "disabled"].filter(a => e.hasAttribute(a)).map(a => `${a}=${e.getAttribute(a)}`).join(" ");
    return `${e.tagName}${e.getAttribute("role") ? `(${e.getAttribute("role")})` : ""} [${e.getAttribute("aria-label") || ""}] ${e.placeholder || ""} ${(e.innerText || "").replace(/\s+/g, " ").slice(0, 80)} ${state}`;
  })).catch(() => []);
  const dialogs = await page.locator("[role=dialog],[role=menu],[role=listbox],[data-radix-popper-content-wrapper]").evaluateAll(els => els.map(e => `<${e.getAttribute("role") || "popper"} aria-label="${e.getAttribute("aria-label") || ""}">\n${e.innerText}`)).catch(() => []);
  fs.writeFileSync(path.join(DUMP, `${name}.txt`), `URL ${page.url()}\n\n${text}\n\n--OVERLAYS--\n${dialogs.join("\n---\n")}\n\n--LINKS--\n${links.join("\n")}\n\n--CONTROLS--\n${controls.join("\n")}\n`);
}
/** Viewport-only capture: what the phone shows, with the header and dock in place. */
async function view(page, name, suffix = "") {
  await page.screenshot({ path: path.join(OUT, `${name}${suffix}.png`) });
  await dump(page, name);
  results.push(`${name}${suffix}.png`);
}
/** Whole page: the viewport grows to the document height so the fixed dock sits at the bottom instead of mid-image. */
async function full(page, name, { viewport = false } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  if (viewport) await view(page, name, ".viewport");
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const capped = Math.min(Math.max(height, VIEWPORT.height), MAX_FULL_HEIGHT);
  if (capped > VIEWPORT.height) { await page.setViewportSize({ width: VIEWPORT.width, height: capped }); await page.waitForTimeout(1200); }
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await dump(page, name);
  if (capped > VIEWPORT.height) { await page.setViewportSize(VIEWPORT); await page.waitForTimeout(300); }
  results.push(`${name}.png${height > MAX_FULL_HEIGHT ? ` (first ${MAX_FULL_HEIGHT} of ${height} px)` : ""}`);
}
async function tap(locator, wait = 900) {
  await locator.first().scrollIntoViewIfNeeded({ timeout: 15000 });
  await locator.first().click({ timeout: 15000 });
  await locator.page().waitForTimeout(wait);
}
const button = (page, name, exact = false) => page.getByRole("button", { name, exact });
async function escape(page) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }

async function signIn(browser, role) {
  const statePath = STATE ? path.join(STATE, `state-${role}.json`) : "";
  const context = await browser.newContext({
    ...devices["iPhone 14"], viewport: VIEWPORT, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, colorScheme: "light", locale: "en-US", timezoneId: "America/New_York",
    ...(statePath && fs.existsSync(statePath) ? { storageState: statePath } : {}),
  });
  // The Next.js dev indicator is not part of the product.
  await context.addInitScript(() => { const hide = () => { const style = document.createElement("style"); style.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(style); }; if (document.documentElement) hide(); else document.addEventListener("DOMContentLoaded", hide); });
  const page = await context.newPage();
  await go(page, "/home");
  if (/\/login|^\/$/.test(new URL(page.url()).pathname) || await page.locator("input[type=password]").count()) {
    const account = accounts(env.root)[role];
    if (!account) throw new Error(`No staging account for role ${role}`);
    if (!/\/login/.test(page.url())) await go(page, "/login");
    await page.locator("input[type=email]").fill(account.email);
    await page.locator("input[type=password]").fill(account.password);
    await page.locator("button[type=submit]").first().click();
    await page.waitForURL(url => !/\/login/.test(url.pathname), { timeout: 120000 });
    await settle(page, 2500);
    console.log(`signed in as ${role}; landed on ${new URL(page.url()).pathname}`);
  }
  await firstRunGuide(page, { student: "02-home-first-run-guide", alumni: "63a-alumni-first-run-guide", leader: "66a-leader-first-run-guide" }[role]);
  if (statePath) await context.storageState({ path: statePath });
  return { context, page };
}
/**
 * First-run tutorial ("Your OutClass guide"): captured once, then skipped as a student would (the skip is saved to the
 * account). Skipping leaves a "Tutorial help" chip above the dock; it is captured once and then hidden with its own
 * close button (remembered in this browser only) so it does not cover every later screen.
 */
async function firstRunGuide(page, name) {
  const skip = button(page, "Skip", true), hide = button(page, "Hide Tutorial help", true);
  await skip.or(hide).first().waitFor({ timeout: 20000 }).catch(() => {});
  if (await skip.count()) {
    if (name) await view(page, name, ".viewport");
    await tap(skip, 2000);
    console.log("first-run gate: tutorial walkthrough skipped");
  }
  if (await hide.count()) {
    if (name) await view(page, `${name}-help-chip`, ".viewport");
    await tap(hide, 600);
  }
}

// ───────────────────────────── screens ─────────────────────────────
// Each entry: [name, role, async (page) => …]. Names are stable so a partial run overwrites the same files.
const screens = [
  // Home tab
  ["01-home", "student", async page => { await go(page, "/home"); await full(page, "01-home", { viewport: true }); }],
  ["03-header-search", "student", async page => { await go(page, "/home"); await tap(button(page, /Search OutClass/)); await view(page, "03-header-search"); await page.keyboard.type("lawn", { delay: 60 }); await page.waitForTimeout(2500); await view(page, "03b-header-search-typed"); await escape(page); }],
  ["04-header-notifications", "student", async page => { await go(page, "/home"); await tap(button(page, /^Notifications/), 2000); await view(page, "04-header-notifications"); await escape(page); }],
  ["05-header-account-menu", "student", async page => { await go(page, "/home"); await tap(button(page, /^Account menu/)); await view(page, "05-header-account-menu"); await escape(page); }],
  ["06-applications-drafts", "student", async page => { await go(page, "/applications"); await full(page, "06-applications-drafts", { viewport: true }); }],
  ["07-applications-in-review", "student", async page => { await go(page, "/applications?tab=in-review"); await full(page, "07-applications-in-review"); }],
  ["08-applications-interviews", "student", async page => { await go(page, "/applications?tab=interviews"); await full(page, "08-applications-interviews"); }],
  ["09-applications-decisions", "student", async page => { await go(page, "/applications?tab=decisions"); await full(page, "09-applications-decisions"); }],
  ["10-my-clubs", "student", async page => { await go(page, "/clubs"); await full(page, "10-my-clubs"); }],
  ["11-tasks", "student", async page => { await go(page, "/clubs/tasks"); await full(page, "11-tasks"); await tap(page.getByRole("combobox", { name: "Status" })); await view(page, "11b-tasks-status-menu"); await escape(page); await tap(page.getByRole("combobox", { name: "Group by" })); await view(page, "11c-tasks-group-menu"); await escape(page); }],
  ["12-task-detail", "student", async page => { await go(page, "/clubs/tasks"); await tap(button(page, /Complete new member onboarding/), 2500); await settle(page); await full(page, "12-task-detail"); }],
  // Explore tab
  ["13-explore", "student", async page => { await go(page, "/explore"); await full(page, "13-explore", { viewport: true }); }],
  ["14-explore-search", "student", async page => { await go(page, "/explore"); await page.getByRole("textbox", { name: "Search clubs" }).fill("consulting"); await page.waitForTimeout(2500); await full(page, "14-explore-search-typed"); await page.getByRole("textbox", { name: "Search clubs" }).fill("zzzqqq"); await page.waitForTimeout(2500); await full(page, "15-explore-search-empty"); }],
  ["16-explore-filter", "student", async page => { await go(page, "/explore"); await tap(button(page, "Filter clubs")); await view(page, "16-explore-filter-sheet"); await escape(page); }],
  ["17-explore-interests", "student", async page => { await go(page, "/explore"); await tap(button(page, /more interests/)); await view(page, "17-explore-more-interests"); await escape(page); await tap(button(page, "Saved clubs")); await view(page, "18-explore-saved-clubs-popover"); await escape(page); }],
  ["19-explore-category", "student", async page => { await go(page, "/explore"); await tap(button(page, "Finance & Investing", true), 2500); await full(page, "19-explore-category-selected"); }],
  ["20-explore-categories", "student", async page => { await go(page, "/explore/categories"); await full(page, "20-explore-categories"); }],
  ["21-events", "student", async page => { await go(page, "/corkboard"); await full(page, "21-events-list", { viewport: true }); await tap(button(page, "Board", true), 2000); await full(page, "22-events-board"); await tap(button(page, "Filters", true)); await view(page, "23-events-filters"); await escape(page); await tap(page.getByRole("combobox", { name: "When" })); await view(page, "23b-events-when-menu"); await escape(page); }],
  ["24-event-detail", "student", async page => { await go(page, "/corkboard"); await tap(page.getByText("FWIT Open House").first(), 2500); await settle(page); await view(page, "24-event-detail"); }],
  ["25-saved-clubs", "student", async page => { await go(page, "/saved-clubs"); await full(page, "25-saved-clubs"); }],
  ["26-club-member", "student", async page => { await go(page, "/club/blue-ridge-consulting"); await full(page, "26-club-blue-ridge-consulting", { viewport: true }); }],
  ["27-club-applicant", "student", async page => { await go(page, "/club/lawn-street-capital"); await full(page, "27-club-lawn-street-capital"); await tap(button(page, "Share", true)); await view(page, "28-club-share-menu"); await escape(page); await tap(button(page, /^Report/)); await view(page, "29-club-report-dialog"); await escape(page); }],
  // Inbox tab
  ["30-inbox", "student", async page => { await go(page, "/inbox"); await full(page, "30-inbox", { viewport: true }); await tap(button(page, /^Unread/), 1500); await full(page, "31-inbox-unread"); await tap(button(page, "Read", true), 1500); await full(page, "32-inbox-read"); await tap(button(page, "Filters", true)); await view(page, "33-inbox-filters"); await escape(page); }],
  ["34-inbox-preferences", "student", async page => { await go(page, "/inbox?tab=preferences"); await view(page, "34-inbox-preferences", ".viewport"); await full(page, "34-inbox-preferences"); }],
  // Calendar tab
  ["35-calendar", "student", async page => { await go(page, "/calendar"); await full(page, "35-calendar-agenda", { viewport: true }); for (const [n, mode] of [["36", "Month"], ["37", "Week"], ["38", "Day"]]) { await tap(button(page, mode, true), 1800); await full(page, `${n}-calendar-${mode.toLowerCase()}`); } }],
  ["39-calendar-menus", "student", async page => { await go(page, "/calendar"); await tap(button(page, "Filters", true)); await view(page, "39-calendar-filters"); await escape(page); await tap(button(page, "Subscribe", true)); await view(page, "40-calendar-subscribe"); await escape(page); }],
  ["41-calendar-event", "student", async page => { await go(page, "/calendar"); await tap(button(page, /FWIT Open House/), 2500); await view(page, "41-calendar-event-detail"); await escape(page); await tap(button(page, /Interview · Confirmed/), 2500); await view(page, "41b-calendar-interview-detail"); await escape(page); }],
  ["42-meetings", "student", async page => { await go(page, "/meetings"); await full(page, "42-meetings"); }],
  ["43-meeting-detail", "student", async page => { await go(page, `/meetings/${LIVE_MEETING}`); await full(page, "43-meeting-detail-live"); }],
  // Profile tab
  ["44-profile", "student", async page => { await go(page, "/profile"); await full(page, "44-profile", { viewport: true }); await tap(button(page, "Edit profile", true), 1800); await view(page, "45-profile-edit"); await escape(page); await tap(button(page, /Preview/), 1800); await view(page, "46-profile-preview"); await escape(page); }],
  ["47-settings", "student", async page => { await go(page, "/settings"); await full(page, "47-settings"); }],
  ["48-settings-account", "student", async page => { await go(page, "/settings/account"); await full(page, "48-settings-account-and-delete"); }],
  ["49-settings-availability", "student", async page => { await go(page, "/settings/availability"); await full(page, "49-settings-availability"); }],
  ["50-settings-interests", "student", async page => { await go(page, "/settings/interests"); await full(page, "50-settings-interests"); }],
  ["51-settings-interviews", "student", async page => { await go(page, "/settings/interviews"); await full(page, "51-settings-interviews-empty"); }],
  // Flows
  ["52-application-form", "student", async page => { await go(page, "/applications"); await tap(button(page, "Continue draft", true), 3000); await settle(page); await full(page, "52-application-form-draft"); }],
  ["53-application-status", "student", async page => { await go(page, "/applications?tab=in-review"); await tap(button(page, /View details|View status/), 3000); await settle(page); await full(page, "53-application-status-in-review"); }],
  ["54-interview-booking", "student", async page => { await go(page, "/applications?tab=interviews"); await tap(button(page, "Review interview", true), 3000); await settle(page); await full(page, "54-interview-booking"); }],
  ["55-interview-booked", "student", async page => { await go(page, "/applications?tab=interviews"); await tap(button(page, "View details", true), 3000); await settle(page); await full(page, "55-interview-booked"); }],
  ["56-decision-rejected", "student", async page => { await go(page, "/applications?tab=decisions"); await tap(button(page, "View details", true), 3000); await settle(page); await full(page, "56-decision-rejected"); }],
  ["58-offer-pending", "student", async page => { await go(page, "/applications?tab=decisions"); await tap(button(page, "Review offer", true), 3000); await settle(page); await full(page, "58-offer-pending"); }],
  ["60-member-workspace", "student", async page => { await go(page, `/club/${LEADER_CLUB}/workspace`); await full(page, "60-member-workspace", { viewport: true }); await tap(button(page, "More sections", true)); await view(page, "61-member-workspace-more-sheet"); await escape(page); }],
  ["62-loading", "student", async page => {
    // A cold navigation, captured before the route's data arrives.
    await go(page, "/home");
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", { offline: false, latency: 1500, downloadThroughput: 40000, uploadThroughput: 40000 });
    await page.locator('nav[aria-label="Sections"] a[href="/calendar"]').click();
    for (const [index, delay] of [300, 900, 1800].entries()) { await page.waitForTimeout(delay); await view(page, `62-loading-skeleton-${index + 1}`); }
    await client.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }],
  // Alumni (read-only club state)
  ["63-alumni-home", "alumni", async page => { await go(page, "/home"); await full(page, "63-alumni-home", { viewport: true }); }],
  ["64-alumni-explore", "alumni", async page => { await go(page, "/explore"); await full(page, "64-alumni-explore"); }],
  ["65-alumni-club", "alumni", async page => { await go(page, "/club/blue-ridge-consulting"); await full(page, "65-alumni-club-blue-ridge-consulting"); await go(page, `/club/${LEADER_CLUB}/workspace`); await full(page, "65b-alumni-member-workspace"); }],
  // Leader (view only)
  ["66-leader-check-in", "leader", async page => { await go(page, `/meetings/${LIVE_MEETING}`); await full(page, "66-leader-meeting-host"); }],
  ["67-leader-voting-room", "leader", async page => { await go(page, `/voting/rooms/${VOTING_SESSION}`); await settle(page, 2500); await full(page, "67-leader-voting-room", { viewport: true }); }],
];

(async () => {
  const roles = args.role ? [args.role] : ["student", "alumni", "leader"];
  const browser = await chromium.launch();
  let failed = 0;
  for (const role of roles) {
    const todo = screens.filter(([name, owner]) => owner === role && (!only || only.test(name)));
    if (!todo.length) continue;
    const { context, page } = await signIn(browser, role);
    for (const [name, , run] of todo) {
      try { if (page.viewportSize().height !== VIEWPORT.height) await page.setViewportSize(VIEWPORT); await run(page); console.log(`ok   ${name}`); }
      catch (error) {
        failed++; console.log(`FAIL ${name}: ${String(error && error.message || error).split("\n")[0].slice(0, 220)}`);
        if (DUMP) { await page.screenshot({ path: path.join(DUMP, `FAIL-${name}.png`) }).catch(() => {}); await dump(page, `FAIL-${name}`).catch(() => {}); }
        await escape(page).catch(() => {});
      }
    }
    await context.close();
  }
  await browser.close();
  console.log(`\n${results.length} screenshots in docs/mobile/screenshots/web${failed ? `; ${failed} screens failed` : ""}`);
  for (const line of results) console.log(`  ${line}`);
})().catch(error => { console.error(String(error && error.message || error).split("\n")[0]); process.exit(1); });
