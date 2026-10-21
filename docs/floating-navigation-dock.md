# Floating navigation dock

The authenticated desktop shell uses an original OutClass dock inspired by the
interaction pattern of a macOS/Framer floating dock. No third-party Framer code
or additional animation dependency is embedded.

## Behavior

- At desktop widths (1024px and up), the sidebar becomes a detached navy,
  rounded dock. Compact icon navigation is the default. The upper control
  expands it into the existing labeled navigation, preserving the same
  permission-filtered destinations, workspace switcher and review tools.
- Hover/focus labels use the existing Radix tooltip primitive (rendered in a
  portal so scrolling cannot clip them). Group triggers retain an accessible
  text name and native compact title. The active destination retains its
  orange marker.
- Only transforms and colors animate for icon focus/hover; page and utility
  positions use the existing shell width token. No JavaScript pointer-tracking
  loop or new navigation/data requests are introduced.
- The expand preference is local to this browser and survives route changes.
  Storage failure is nonfatal.
- Tablet and mobile retain their original labeled drawer and bottom navigation.
  Reduced-motion users get no icon magnification or width transition.
- All hrefs, navigation callbacks, security gates, unsaved-change checks,
  keyboard focus, workspace switching, authorization checks and data providers
  remain in ProductShell. The public landing header is unchanged.

## Verification

Run `node scripts/check-floating-header.cjs` after the normal local install and
production build. This exercises the real ProductShell in a fictional fixture,
including compact/expanded dock and portaled tooltip. Also run
`npm run typecheck`, `npm run lint`, and `npm run build`.

Manual review before merge:

- Personal workspace: Explore / Apply / My Clubs, Home, Calendar, Inbox,
  Profile and Settings, plus each active state.
- Leader in recruiting / club modes with different memberships: group expand,
  nested Resume / Review destinations, quiet Review Tools, and workspace switch.
- Platform admin: overflow scrolling, grouped headings and settings.
- Keyboard-only tab order/focus and tooltip, 1024px breakpoint, 200% zoom,
  pointer and no-hover devices, reduced motion, and browser Back/Forward.
- Unsaved form guard, notification overlay, header modes and search, and mobile
  drawer at 320px and 390px.

No backend, schema, authorization policy, or environment change is required.
