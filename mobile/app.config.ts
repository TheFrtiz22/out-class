import fs from "node:fs";
import path from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

// Public configuration only. The app ships the Supabase URL and publishable key and nothing
// else; every private read and write goes through the mobile API (docs/mobile/architecture.md).
// Values come from EXPO_PUBLIC_* (EAS environments for builds) or, for local development, from
// the git-ignored config.local.json beside this file (see config.example.json).
type PublicConfig = { apiUrl?: string; supabaseUrl?: string; supabasePublishableKey?: string; turnstileSiteKey?: string; sentryDsn?: string };
function localConfig(): PublicConfig {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "config.local.json"), "utf8")) as PublicConfig; } catch { return {}; }
}
/** One entry of the iOS privacy manifest's collected data: used only for the app to work, never for tracking. */
const collected = (type: string, linked: boolean) => ({
  NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
  NSPrivacyCollectedDataTypeLinked: linked,
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
});
const local = localConfig();
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? local.apiUrl ?? "https://www.out-class.net";
// The production Supabase project's address and publishable key. Both are public (the web sends the
// same two to every browser), and they are the defaults so a fresh clone run in Expo Go signs in with
// no hidden file: without them the app sent sign-in to a placeholder address and showed only "try again".
// EXPO_PUBLIC_* or config.local.json still override them, for a local server or a staging project.
const PRODUCTION_SUPABASE = { url: "https://htlgjluegmdwfjkzzwic.supabase.co", publishableKey: "sb_publishable_H-crMmjPAlJ6L2RvwoAAVw_Bpz-fLDa" };

/** A value copied from config.example.json or left half-filled ("sb_publishable_...", "<project-ref>"). */
export function isPlaceholder(value: string | undefined): boolean {
  return !value || !value.trim() || /\.\.\.|[<>]|placeholder|your[-_ ]/i.test(value);
}

/**
 * The Supabase address and key always come as a pair from one place: EXPO_PUBLIC_* first, then
 * config.local.json, then production. A place that sets only one of the two, or a placeholder, is
 * skipped, so a half-filled local file can never pair production's address with a key it refuses.
 * `source` is shown under a refused sign-in in development, so a stale override is easy to find.
 */
export function supabasePair(env: NodeJS.ProcessEnv, file: PublicConfig) {
  const candidates = [
    { url: env.EXPO_PUBLIC_SUPABASE_URL, key: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, source: "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" },
    { url: file.supabaseUrl, key: file.supabasePublishableKey, source: "mobile/config.local.json" },
  ];
  const chosen = candidates.find(candidate => !isPlaceholder(candidate.url) && !isPlaceholder(candidate.key));
  return chosen
    ? { url: chosen.url!.trim().replace(/\/+$/, ""), key: chosen.key!.trim(), source: chosen.source }
    : { url: PRODUCTION_SUPABASE.url, key: PRODUCTION_SUPABASE.publishableKey, source: "the built-in production settings" };
}
const supabase = supabasePair(process.env, local);

// The app's Sentry project (outclass-ot/outclass-mobile). A DSN only lets a client send reports, so it
// is public like the web's. EXPO_PUBLIC_SENTRY_DSN or config.local.json can point elsewhere, or set "off".
const PRODUCTION_SENTRY_DSN = "https://c5bcc247482cdd3247db5e98d5a65c34@o4512386190999552.ingest.us.sentry.io/4512471586897920";
export function sentryDsn(env: NodeJS.ProcessEnv, file: PublicConfig): string {
  const chosen = [env.EXPO_PUBLIC_SENTRY_DSN, file.sentryDsn].find(value => !isPlaceholder(value));
  return chosen?.trim() ?? PRODUCTION_SENTRY_DSN;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "OutClass",
  slug: "outclass",
  owner: "outclass",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "outclass",
  userInterfaceStyle: "automatic",
  ios: {
    // Icon Composer document (iOS 26 Liquid Glass): the ivory OC monogram on navy. icon.png stays the fallback.
    icon: "./assets/icon/OutClass.icon",
    bundleIdentifier: "net.outclass.app",
    // iPad runs OutClass natively (regular width shows two panes; src/lib/layout.ts) in every orientation and in
    // Split View. iPhones stay portrait (top-level orientation); the iPhone Duo's inner display ignores supported
    // orientations and resizes the app anyway (Apple, "Prepare your app for iPhone Duo"). App Store submissions now
    // need iPad screenshots.
    supportsTablet: true,
    // Universal links: the web serves apple-app-site-association. The apex domain carries /q
    // short links for every school, so only it is associated.
    associatedDomains: ["applinks:out-class.net", "applinks:www.out-class.net"],
    infoPlist: {
      NSCameraUsageDescription: "OutClass uses the camera to scan check-in codes and to take your profile photo.",
      NSPhotoLibraryUsageDescription: "OutClass uses your photo library so you can choose a profile photo.",
      NSCalendarsFullAccessUsageDescription: "OutClass adds interviews and events to your calendar when you ask it to.",
      NSCalendarsWriteOnlyAccessUsageDescription: "OutClass adds interviews and events to your calendar when you ask it to.",
      ITSAppUsesNonExemptEncryption: false,
      "UISupportedInterfaceOrientations~ipad": ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"],
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      // Matches the App Store privacy label (docs/mobile/store/privacy.md): nothing is used for tracking,
      // everything only for the app to work. Crash and diagnostic data are not linked to the account.
      NSPrivacyCollectedDataTypes: [
        collected("Name", true),
        collected("EmailAddress", true),
        collected("PhoneNumber", true),
        collected("PhotosorVideos", true),
        collected("OtherUserContent", true),
        collected("UserID", true),
        collected("DeviceID", true),
        collected("ProductInteraction", true),
        collected("CrashData", false),
        collected("OtherDiagnosticData", false),
        collected("OtherDataTypes", true),
      ],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
    },
  },
  android: {
    package: "net.outclass.app",
    // Firebase config for Android push (FCM). Public identifiers only; the FCM service-account key lives in
    // Expo credentials, never here. Omitted when the file is absent so builds without it still configure.
    googleServicesFile: fs.existsSync(path.join(__dirname, "google-services.json")) ? "./google-services.json" : undefined,
    adaptiveIcon: {
      backgroundColor: "#0F2E56",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    permissions: ["android.permission.CAMERA", "android.permission.POST_NOTIFICATIONS", "android.permission.VIBRATE"],
    // The camera and image picker libraries declare the microphone for video; the app never records,
    // so the permission is removed from the merged manifest (no Play Store data-safety question for it).
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
    intentFilters: [
      { action: "VIEW", autoVerify: true, data: [{ scheme: "https", host: "out-class.net" }, { scheme: "https", host: "www.out-class.net" }, { scheme: "https", pathPrefix: "/q/" }, { scheme: "https", path: "/reset-password" }], category: ["BROWSABLE", "DEFAULT"] },
    ],
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { backgroundColor: "#0F2E56", image: "./assets/images/splash-icon.png", imageWidth: 96 }],
    ["expo-font", { fonts: ["./assets/fonts/LibreCaslonText-Regular.ttf", "./assets/fonts/LibreCaslonText-SemiBold.ttf"] }],
    "expo-secure-store",
    ["expo-camera", { cameraPermission: "OutClass uses the camera to scan check-in codes and to take your profile photo.", microphonePermission: false, recordAudioAndroid: false }],
    ["expo-image-picker", { photosPermission: "OutClass uses your photo library so you can choose a profile photo.", cameraPermission: "OutClass uses the camera to take your profile photo.", microphonePermission: false }],
    ["expo-calendar", { calendarPermission: "OutClass adds interviews and events to your calendar when you ask it to." }],
    // Android draws the status-bar icon from its alpha alone: the monogram, not the square app icon.
    ["expo-notifications", { color: "#232D4B", icon: "./assets/images/android-icon-monochrome.png" }],
    "expo-sharing",
    "expo-localization",
    // Long-press app-icon shortcuts (Scan). Items are set at runtime in src/app/_layout.tsx.
    "expo-quick-actions",
    // Crash reporting (src/lib/report.ts). Source-map and debug-symbol upload needs a Sentry auth token
    // in EAS secrets (SENTRY_AUTH_TOKEN); until one is added the upload is off so builds never fail on it.
    ["@sentry/react-native/expo", { organization: "outclass-ot", project: "outclass-mobile", disableAutoUpload: true }],
    // Android release builds refuse plain HTTP. It is allowed only when this build's API address is plain
    // HTTP (a local server on staging data); a production build's address is HTTPS, so it stays refused.
    ["expo-build-properties", { ios: { deploymentTarget: "17.0" }, android: { usesCleartextTraffic: apiUrl.startsWith("http://") } }],
  ],
  experiments: { reactCompiler: true },
  extra: {
    // EAS project @outclass/outclass. The app needs it to request an Expo push token (src/lib/push.ts).
    eas: { projectId: "23668155-43a1-4bf7-9b89-1f61a42b535b" },
    apiUrl,
    supabaseUrl: supabase.url,
    supabasePublishableKey: supabase.key,
    supabaseSource: supabase.source,
    turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? local.turnstileSiteKey ?? "",
    sentryDsn: sentryDsn(process.env, local),
  },
});
