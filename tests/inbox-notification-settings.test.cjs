// Notification and email-digest preferences live in the Inbox (FE-13): a gear in the Inbox header opens the same
// preferences form in a sheet; Settings → Notifications, Settings navigation and Cmd-K all lead there.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

const read = file => fs.readFileSync(file, "utf8")
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(require, mod, mod.exports)
  return mod.exports
}
const nav = load("lib/settings-navigation.ts")

test("one address for notification settings: the Inbox, with the preferences sheet open", () => {
  assert.equal(nav.notificationSettingsHref, "/inbox?tab=preferences")
  const open = search => nav.isNotificationSettingsOpen(new URLSearchParams(search))
  assert.equal(open("tab=preferences"), true)
  assert.equal(open(""), false)
  assert.equal(open("tab=notifications"), false)
  // Emails already link to this address; the notification/digest code is unchanged.
  assert.match(read("lib/notification-email.ts"), /"\/inbox\?tab=preferences"/)
})

test("the Inbox header shows the Notification settings entry point", () => {
  const layout = read("components/dashboard-layout.tsx")
  assert.match(layout, /action=\{view === "inbox" \? <InboxNotificationSettings \/> : undefined\}/)
  const control = read("components/inbox/inbox-notification-settings.tsx")
  assert.match(control, /<IconButton ref=\{trigger\} variant="outline" aria-label="Notification settings"[^>]*aria-haspopup="dialog"/)
  assert.match(control, /<Settings aria-hidden="true" \/>/)
  assert.match(control, /from "@\/components\/icons"/, "Phosphor icons through @/components/icons")
  assert.match(control, /<SheetTitle>Notification settings<\/SheetTitle>/)
  // Reuses the existing form (no copy), loaded only when opened; Demo Mode never touches real preferences.
  assert.match(control, /import\("@\/components\/communications-preferences"\)/)
  assert.match(control, /\{open && <CommunicationsPreferences embedded \/>\}/)
  assert.match(control, /if \(demo\.isDemoEnabled\) return null/)
  // Closing guards an in-flight save and unsaved edits, and focus returns to the gear.
  assert.match(control, /\[data-saving="true"\]/)
  assert.match(control, /\[data-unsaved="true"\][^\n]*window\.confirm/)
  assert.match(control, /onCloseAutoFocus=[^\n]*target\.focus\(\)/)
  // The Inbox page no longer redirects preferences away, and the old in-page Settings link is gone.
  assert.doesNotMatch(read("app/(workspace)/inbox/page.tsx"), /redirect\(/)
  assert.doesNotMatch(read("components/views/inbox-view.tsx"), /settings\/notifications|are in Settings/)
})

test("the preferences form keeps its saving logic; embedding only drops the duplicate heading", () => {
  const form = read("components/communications-preferences.tsx")
  assert.match(form, /export function CommunicationsPreferences\(\{embedded=false\}:\{embedded\?:boolean\}=\{\}\)/)
  assert.match(form, /\{!embedded&&<h2 className="oc-section-heading">Email notification preferences<\/h2>\}/)
  assert.match(form, /await saveNotificationPreferences\(\{/)
  assert.match(form, /data-unsaved=\{dirty\} data-saving=\{saving\}/)
})

test("the old Settings URL, Settings navigation, Cmd-K and the notification center lead to the Inbox", () => {
  const old = read("app/(workspace)/settings/notifications/page.tsx")
  assert.match(old, /redirect\(notificationSettingsHref\)/)
  assert.equal(fs.existsSync("app/(workspace)/settings/notifications/loading.tsx"), false, "a loader would stream before the redirect")
  const section = nav.personalSettingsSections.find(item => item.id === "notifications")
  assert.deepEqual([section.label, section.href], ["Notifications", "/inbox?tab=preferences"])
  assert.ok(!nav.personalSettingsSections.some(item => item.href === "/settings/notifications"))
  assert.match(read("components/shell/product-shell.tsx"), /\{ id: "notification-settings", title: "Notification settings", href: notificationSettingsHref \}/)
  assert.match(read("components/shell/notification-center.tsx"), /href=\{notificationSettingsHref\}/)
  for (const file of ["components/shell/notification-center.tsx", "components/views/inbox-view.tsx", "components/shell/product-shell.tsx", "components/settings/personal-settings-layout.tsx", "app/(workspace)/settings/page.tsx"])
    assert.doesNotMatch(read(file), /"\/settings\/notifications"/, file)
})
