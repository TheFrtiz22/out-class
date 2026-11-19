// Captures app screenshots by opening deep links in an installed RELEASE build that is already signed in.
// Run: node scripts/staging/capture.cjs <ios|android> <deviceId|-> <light|dark> <set> [startIndex]
//   sets: student | leader | alumni | signedout   (sign in first with mobile/e2e/release-sign-in.yaml)
// Writes docs/mobile/screenshots/<platform>/<theme>/NN-name.png. Opens only outclass:// links; reads nothing private.
"use strict";
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const [platform, device, theme, set, start = "1"] = process.argv.slice(2);
const root = path.resolve(__dirname, "../..");
const out = path.join(root, "docs/mobile/screenshots", platform, theme);
fs.mkdirSync(out, { recursive: true });

const CLUB = "253d3ff8-35eb-4619-81bf-c7c195bbf4fe";
const MEETING = "52fd84d2-ca4e-439c-b794-03ca91eca68b";
const SESSION = "e89ed370-6e82-4b3d-a454-091e0b109207";
const APPS = { draft: "27933a5a-c44f-4416-aa03-f667be79bc23", submitted: "4739ce79-55e1-4293-9327-f3eba26fb4b5", bookable: "16e1fc5c-795e-484d-8826-973721f6996c", booked: "30520845-fab4-4c0a-9f29-099e390a45aa", offer: "84f4f4dc-3fdd-44ea-8331-0524ccad446f", rejected: "37972775-3e1b-4faa-8295-6f46f4b1d8fe" };

// [number, name, route, seconds to settle]
const sets = {
  signedout: [[1, "sign-in", "", 4]],
  student: [
    [2, "home", "", 6], [3, "explore", "explore", 6], [4, "club", "club/blue-ridge-consulting", 6], [5, "club-open-applications", "club/lawn-street-capital", 6],
    [6, "saved-clubs", "saved-clubs", 5], [7, "events-board", "events", 6], [8, "inbox", "inbox", 6], [9, "calendar", "calendar", 6], [10, "profile", "profile", 6],
    [11, "applications", "applications", 6], [12, "application-draft", `application/${APPS.draft}`, 6], [13, "application-submitted", `application/${APPS.submitted}`, 6],
    [14, "interview-booking", `interview/${APPS.bookable}`, 7], [15, "interview-booked", `interview/${APPS.booked}`, 7], [16, "decision-letter", `decision/${APPS.rejected}`, 7], [17, "offer", `decision/${APPS.offer}`, 7],
    [18, "tasks", "tasks", 6], [19, "my-club", `my-club/${CLUB}`, 6], [20, "meeting", `meeting/${MEETING}`, 6], [21, "settings", "settings", 5], [22, "settings-account", "settings/account", 5], [23, "settings-notifications", "settings/notifications", 5],
    [24, "scanner", "scan", 5],
  ],
  leader: [
    [40, "leader-home", "", 6], [41, "leader-tools", `leader/${CLUB}`, 7], [42, "leader-host-check-in", `leader/${CLUB}/check-in/${MEETING}`, 8], [43, "leader-door-mode", `leader/${CLUB}/door/${MEETING}`, 5],
    [44, "leader-voting-rooms", `leader/${CLUB}/voting`, 7], [45, "leader-voting-room", `voting/${SESSION}?clubId=${CLUB}`, 9], [46, "leader-applicants", `leader/${CLUB}/applicants`, 8], [47, "leader-announce", `leader/${CLUB}/announce`, 5], [48, "leader-interview-day", `leader/${CLUB}/interviews`, 8],
  ],
  alumni: [[60, "alumni-home", "", 6], [61, "alumni-profile", "profile", 6], [62, "alumni-club", "club/lawn-street-capital", 6], [63, "alumni-inbox", "inbox", 6]],
};
const sleep = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));
const adb = path.join(process.env.HOME, "Library/Android/sdk/platform-tools/adb");
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });

function setTheme() {
  if (platform === "ios") run("xcrun", ["simctl", "ui", device, "appearance", theme]);
  else run(adb, ["shell", "cmd", "uimode", "night", theme === "dark" ? "yes" : "no"]);
}
function open(route) {
  const url = `outclass://${route}`;
  if (platform === "ios") run("xcrun", ["simctl", "openurl", device, url]);
  else run(adb, ["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", `'${url}'`, "net.outclass.app"]);
}
function shot(file) {
  if (platform === "ios") run("xcrun", ["simctl", "io", device, "screenshot", file]);
  else fs.writeFileSync(file, run(adb, ["exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024 }));
}

(async () => {
  setTheme();
  await sleep(2);
  for (const [number, name, route, settle] of sets[set].filter(item => item[0] >= Number(start))) {
    open(route);
    await sleep(settle);
    const file = path.join(out, `${String(number).padStart(2, "0")}-${name}.png`);
    shot(file);
    console.log(path.relative(root, file));
  }
})().catch(error => { console.error(error.message); process.exit(1); });
