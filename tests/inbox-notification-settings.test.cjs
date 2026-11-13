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
const sheet = load("lib/notification-settings-sheet.ts")

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
  assert.match(control, /if \(demo\.isDemoEnabled\) return null/)
  // Unsaved edits get an inline confirm (no window.confirm); focus moves to Keep editing. Focus returns to the gear.
  assert.doesNotMatch(control, /window\.confirm/)
  assert.match(control, />Discard changes\?</)
  assert.match(control, /<Button ref=\{keep\} size="sm" variant="ghost" onClick=\{keepEditing\}>Keep editing<\/Button>/)
  assert.match(control, /onClick=\{\(\) => close\(true\)\}>Discard<\/Button>/)
  assert.match(control, /if \(confirming\) keep\.current\?\.focus\(\)/)
  assert.match(control, /onCloseAutoFocus=[^\n]*target\.focus\(\)/)
  // Close stays enabled during a save: "Saving…" shows, and a save still in flight on close finishes with a toast.
  assert.match(control, /\{saving && <p role="status"[^>]*>Saving…<\/p>\}/)
  assert.match(control, /toast\.loading\("Saving notification settings…"/)
  assert.match(control, /<CommunicationsPreferences embedded onSave=\{onSave\} \/>/)
  assert.match(control, /addEventListener\("beforeunload", warn\)/)
  // The Inbox page no longer redirects preferences away, and the old in-page Settings link is gone.
  assert.doesNotMatch(read("app/(workspace)/inbox/page.tsx"), /redirect\(/)
  assert.doesNotMatch(read("components/views/inbox-view.tsx"), /settings\/notifications|are in Settings/)
})

test("the preferences form keeps its saving logic; embedding only drops the duplicate heading", () => {
  const form = read("components/communications-preferences.tsx")
  assert.match(form, /export function CommunicationsPreferences\(\{embedded=false,onSave\}/)
  assert.match(form, /setMessage\("Preferences saved."\);onSave\?\.\("saved"\)/)
  assert.match(form, /setMessage\("Could not save preferences."\);onSave\?\.\("failed"\)/)
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

test("history: the gear opens without a history entry; a deep link closes by clearing its param once", () => {
  const state = (over = {}) => ({ fromUrl: false, dirty: false, saving: false, ...over })
  assert.equal(sheet.closeStep(state()), "close")
  assert.equal(sheet.closeStep(state({ fromUrl: true })), "clear-url")
  // Unsaved edits ask first (inline bar); Discard then closes the same way.
  assert.equal(sheet.closeStep(state({ dirty: true })), "confirm")
  assert.equal(sheet.closeStep(state({ fromUrl: true, dirty: true })), "confirm")
  assert.equal(sheet.closeStep(state({ dirty: true }), true), "close")
  assert.equal(sheet.closeStep(state({ fromUrl: true, dirty: true }), true), "clear-url")
  // A save in flight never blocks closing; it finishes in the background.
  assert.equal(sheet.closeStep(state({ dirty: true, saving: true })), "close")
  const control = read("components/inbox/inbox-notification-settings.tsx")
  assert.match(control, /onClick=\{\(\) => setOpen\(true\)\}/, "the gear changes no URL")
  assert.doesNotMatch(control, /router\.(push|back)\(/, "no pushed entries and no Back interception")
  assert.equal(control.match(/router\.replace\(/g).length, 1)
  // Closing is a state change first; the URL is cleared afterwards, only for a deep link.
  assert.match(control, /setOpen\(false\); setConfirming\(false\); fromUrl\.current = false[\s\S]*step === "clear-url"[\s\S]*router\.replace/)
})

test("Settings: Notifications is never the active Settings page, and Demo Mode hides it", () => {
  assert.equal(nav.personalSettingsSectionFor("/settings/account").id, "account")
  assert.equal(nav.personalSettingsSectionFor("/settings/availability").id, "availability")
  assert.equal(nav.personalSettingsSectionFor("/inbox"), undefined)
  assert.equal(nav.personalSettingsSectionFor("/settings/notifications"), undefined)
  assert.deepEqual(nav.visiblePersonalSettingsSections(false).map(item => item.id), ["account", "notifications", "availability", "interests", "interviews"])
  assert.deepEqual(nav.visiblePersonalSettingsSections(true).map(item => item.id), ["account", "availability"])
  assert.match(read("components/settings/personal-settings-layout.tsx"), /visiblePersonalSettingsSections\(demo\.isDemoEnabled\)/)
  assert.match(read("components/settings/personal-settings-overview.tsx"), /visiblePersonalSettingsSections\(demo\.isDemoEnabled\)/)
  assert.match(read("app/(workspace)/settings/page.tsx"), /<PersonalSettingsOverview \/>/)
  assert.match(read("components/shell/workspace-shell.tsx"), /personalSettingsSectionFor\(pathname\)\?\.label/)
})
