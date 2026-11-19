// Builds docs/mobile/screenshots/index.html: every app screenshot grouped by tab and flow, iOS and Android
// side by side in light and dark, and web-versus-app parity pairs. Run: node scripts/staging/build-screenshot-index.cjs
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const dir = path.resolve(__dirname, "../../docs/mobile/screenshots");
const exists = file => fs.existsSync(path.join(dir, file));

// number-name -> [caption, group, web parity screenshot]
const screens = [
  ["01-sign-in", "Sign in", "Start", null],
  ["02-home", "Home: next step, check-in pass, tasks, applications, clubs", "Home", "01-home.png"],
  ["18-tasks", "Tasks", "Home", "11-tasks.png"],
  ["11-applications", "Applications", "Home", "06-applications-drafts.png"],
  ["19-my-club", "A club you belong to", "Home", "60-member-workspace.png"],
  ["03-explore", "Explore clubs", "Explore", "13-explore.png"],
  ["04-club", "Club page (member)", "Explore", "26-club-blue-ridge-consulting.png"],
  ["05-club-open-applications", "Club page with applications open", "Explore", "27-club-lawn-street-capital.png"],
  ["06-saved-clubs", "Saved clubs", "Explore", "25-saved-clubs.png"],
  ["07-events-board", "Events", "Explore", "21-events-list.png"],
  ["08-inbox", "Inbox", "Inbox", "30-inbox.png"],
  ["23-settings-notifications", "Notification settings, with the push switch", "Inbox", "34-inbox-preferences.png"],
  ["27-push-banner", "A push notification (simulator-delivered; lock-screen-safe wording)", "Inbox", null],
  ["09-calendar", "Calendar", "Calendar", "35-calendar-agenda.png"],
  ["20-meeting", "Meeting", "Calendar", "43-meeting-detail-live.png"],
  ["10-profile", "Profile", "Profile", "44-profile.png"],
  ["21-settings", "Settings", "Profile", "47-settings.png"],
  ["22-settings-account", "Account and account deletion", "Profile", "48-settings-account-and-delete.png"],
  ["12-application-draft", "Application draft (autosaves)", "Apply", "52-application-form-draft.png"],
  ["13-application-submitted", "Submitted application", "Apply", "53-application-status-in-review.png"],
  ["14-interview-booking", "Book an interview (Eastern Time)", "Interviews", "54-interview-booking.png"],
  ["15-interview-booked", "Booked interview", "Interviews", "55-interview-booked.png"],
  ["16-decision-letter", "Decision letter", "Decisions", "57-decision-letter-rejected.png"],
  ["17-offer", "Offer awaiting a response", "Decisions", "58-offer-pending.png"],
  ["24-scanner", "Scanner (the simulator has no camera image)", "Check-in", null],
  ["25-check-in-pass", "Personal check-in pass (rotating, single use)", "Check-in", null],
  ["26-check-in-result", "Check-in result after opening a room code", "Check-in", null],
  ["28-error-state", "Error state", "States", null],
  ["29-offline-state", "Offline state", "States", null],
  ["40-leader-home", "Home for a leader", "Leader tools", null],
  ["41-leader-tools", "Leader tools", "Leader tools", null],
  ["42-leader-host-check-in", "Check-in host mode", "Leader tools", "66c-leader-check-in-presenter.png"],
  ["43-leader-door-mode", "Door mode scanner (no camera image in the simulator)", "Leader tools", null],
  ["44-leader-voting-rooms", "Voting rooms", "Leader tools", null],
  ["45-leader-voting-room", "Live vote, host view", "Leader tools", "67-leader-voting-room.png"],
  ["46-leader-applicants", "Applicant glance", "Leader tools", null],
  ["47-leader-announce", "Quick announce", "Leader tools", null],
  ["48-leader-interview-day", "Interview day", "Leader tools", null],
  ["60-alumni-home", "Alumni: Home (read-only)", "Alumni", "63-alumni-home.png"],
  ["61-alumni-profile", "Alumni: Profile", "Alumni", null],
  ["62-alumni-club", "Alumni: club page", "Alumni", "65-alumni-club-blue-ridge-consulting.png"],
  ["63-alumni-inbox", "Alumni: Inbox", "Alumni", null],
];
const esc = text => text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cell = (file, label) => exists(file)
  ? `<figure><a href="${file}"><img loading="lazy" src="${file}" alt="${esc(label)}"></a><figcaption>${esc(label)}</figcaption></figure>`
  : `<figure class="missing"><div>Not captured</div><figcaption>${esc(label)}</figcaption></figure>`;

let body = "", counts = { ios: 0, android: 0 };
const groups = [...new Set(screens.map(screen => screen[2]))];
for (const group of groups) {
  body += `<section><h2>${esc(group)}</h2>`;
  for (const [id, caption] of screens.filter(screen => screen[2] === group)) {
    for (const p of ["ios", "android"]) for (const t of ["light", "dark"]) if (exists(`${p}/${t}/${id}.png`)) counts[p]++;
    body += `<article><h3>${esc(caption)}</h3><div class="row">${cell(`ios/light/${id}.png`, "iOS · light")}${cell(`ios/dark/${id}.png`, "iOS · dark")}${cell(`android/light/${id}.png`, "Android · light")}${cell(`android/dark/${id}.png`, "Android · dark")}</div></article>`;
  }
  body += `</section>`;
}
body += `<section><h2>Web and app, side by side</h2><p class="note">The phone-width website (390 pt, light) beside the same screen in the app. Web captures are full-page, so they run longer.</p>`;
for (const [id, caption, , web] of screens.filter(screen => screen[3])) {
  body += `<article><h3>${esc(caption)}</h3><div class="row pair">${cell(`web/${web}`, "Website at phone width")}${cell(`ios/light/${id}.png`, "App · iOS")}${cell(`android/light/${id}.png`, "App · Android")}</div></article>`;
}
body += `</section>`;
const recordings = fs.existsSync(path.join(dir, "../recordings")) ? fs.readdirSync(path.join(dir, "../recordings")).filter(name => /\.(mp4|mov)$/.test(name)) : [];
if (recordings.length) body += `<section><h2>Recordings</h2><div class="row">${recordings.map(name => `<figure><video controls preload="metadata" src="../recordings/${name}"></video><figcaption>${esc(name)}</figcaption></figure>`).join("")}</div></section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OutClass app screenshots</title>
<style>
:root{--bg:#f6f5f1;--fg:#232d4b;--muted:#52606d;--card:#fffefa;--border:#dfe3dd}
@media (prefers-color-scheme:dark){:root{--bg:#0f1c2b;--fg:#f6f5f1;--muted:#b0c1cc;--card:#162638;--border:#2c4257}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 "Source Sans 3",system-ui,sans-serif}
header,section{max-width:1280px;margin:0 auto;padding:16px}
h1{font:500 34px/1.15 "Libre Caslon Text",Georgia,serif;margin:16px 0 4px}
h2{font:500 26px/1.2 "Libre Caslon Text",Georgia,serif;margin:28px 0 8px;border-top:1px solid var(--border);padding-top:20px}
h3{font-size:16px;margin:18px 0 8px}
.note,header p{color:var(--muted);margin:4px 0;max-width:70ch}
.row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.row.pair{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:720px){.row,.row.pair{grid-template-columns:repeat(2,minmax(0,1fr))}}
figure{margin:0;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:8px}
img,video{display:block;width:100%;height:auto;border-radius:10px}
figcaption{font-size:12px;color:var(--muted);padding:6px 2px 0}
.missing div{aspect-ratio:9/19.5;display:grid;place-items:center;color:var(--muted);border:1px dashed var(--border);border-radius:10px;font-size:13px}
</style></head><body>
<header><h1>OutClass app screenshots</h1>
<p>Release builds on the iPhone 18 Pro simulator (iOS 27.2) and a Pixel 9 emulator (Android 16), signed in to the staging project with seeded, fictional clubs and students. Captured 2026-11-18.</p>
<p>${counts.ios} iOS and ${counts.android} Android captures. "Not captured" marks a screen that was not reached on that platform; the final report says why.</p></header>
${body}</body></html>`;
fs.writeFileSync(path.join(dir, "index.html"), html);
console.log(`index.html: ${counts.ios} iOS, ${counts.android} Android captures, ${recordings.length} recordings`);
