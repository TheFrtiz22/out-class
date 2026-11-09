# OutClass mobile (iOS + Android)

Expo (SDK 58) + Expo Router app. It is a client of the web app's `/api/v1` endpoints; it never reads the database directly and only uses Supabase for sign-in.

Design brief: the "OutClass Mobile — Design Inspiration" doc (five student tabs: Home, Explore, Inbox, Calendar, Profile; To-do inside Home; Corkboard inside Explore; light and dark follow the system).

## Run it

```bash
cd mobile
npm install            # this folder has its own npm lockfile; it is not part of the pnpm workspace
cp .env.example .env   # fill in staging values; never commit .env
npx expo start         # then press i (iOS simulator), a (Android), or scan the QR with Expo Go
```

`EXPO_PUBLIC_API_URL` must point at a deployment that includes `/api/v1` (a Vercel preview of this branch, or staging). Production does not have these routes until this work merges.

## How it talks to the server

- Sign-in: UVA email + password, or a 6-digit emailed code, exactly as on the web. No accounts are created from the app.
- Sessions live in the device keychain/keystore (`expo-secure-store`).
- Every request sends `Authorization: Bearer <access token>`. The server checks it with `utils/bearer-auth.ts`, which applies the same checks as the web session: provider-verified token, live session row, confirmed UVA email, account not disabled.

## Endpoints used so far

| Endpoint | Screen |
| --- | --- |
| `GET /api/v1/me` | Home (clubs, applications), Profile |
| `GET /api/v1/clubs` | Explore |

Add an endpoint by moving the action's logic into a function the server action and a thin `app/api/v1/.../route.ts` both call, and start the route with `requireBearerAuth(request)`. `tests/api-v1-routes.test.cjs` fails any v1 route that doesn't.

## Conventions

- The app is the website's design language on a phone: Libre Caslon Text for titles, Source Sans 3 for text, ivory cards with soft navy shadows, navy glass panels and buttons, the floating navy dock as the tab bar, the site's logo artwork (`assets/brand/logos.ts`, generated from `public/brand/premium-board`) and its campus photography. Build new screens from `components/ui.tsx`, not raw styles.
- Colors only from `theme/tokens.ts` (mirrors `styles/tokens.css` and `styles/navigation-glass.css`; light = web default, dark = the web's dark "present" theme). Every screen must work in both.
- Icons: Phosphor (`phosphor-react-native`), as on the web.
- Add packages with versions from `node_modules/expo/bundledNativeModules.json` (or `npx expo install` where it can reach Expo's API).

## Checks

```bash
npx tsc --noEmit
npx expo export --platform ios     # bundles the app; catches import and syntax errors
npx expo export --platform android
```
