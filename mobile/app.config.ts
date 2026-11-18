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
const local = localConfig();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "OutClass",
  slug: "outclass",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "outclass",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "net.outclass.app",
    supportsTablet: false,
    // Universal links: the web serves apple-app-site-association. The apex domain carries /q
    // short links for every school, so only it is associated.
    associatedDomains: ["applinks:out-class.net"],
    infoPlist: {
      NSCameraUsageDescription: "OutClass uses the camera to scan check-in codes and to take your profile photo.",
      NSPhotoLibraryUsageDescription: "OutClass uses your photo library so you can choose a profile photo.",
      NSCalendarsFullAccessUsageDescription: "OutClass adds interviews and events to your calendar when you ask it to.",
      NSCalendarsWriteOnlyAccessUsageDescription: "OutClass adds interviews and events to your calendar when you ask it to.",
      ITSAppUsesNonExemptEncryption: false,
      UIApplicationShortcutItems: [
        { UIApplicationShortcutItemType: "net.outclass.app.scan", UIApplicationShortcutItemTitle: "Scan", UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeCapturePhoto" },
        { UIApplicationShortcutItemType: "net.outclass.app.pass", UIApplicationShortcutItemTitle: "Check-in pass", UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeContact" },
      ],
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
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
    adaptiveIcon: {
      backgroundColor: "#0F2E56",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    permissions: ["android.permission.CAMERA", "android.permission.POST_NOTIFICATIONS", "android.permission.VIBRATE"],
    intentFilters: [
      { action: "VIEW", autoVerify: true, data: [{ scheme: "https", host: "out-class.net", pathPrefix: "/q/" }], category: ["BROWSABLE", "DEFAULT"] },
    ],
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { backgroundColor: "#0F2E56", image: "./assets/images/splash-icon.png", imageWidth: 96 }],
    ["expo-font", { fonts: ["./assets/fonts/LibreCaslonText-Regular.ttf", "./assets/fonts/LibreCaslonText-SemiBold.ttf"] }],
    "expo-secure-store",
    ["expo-camera", { cameraPermission: "OutClass uses the camera to scan check-in codes and to take your profile photo.", recordAudioAndroid: false }],
    ["expo-image-picker", { photosPermission: "OutClass uses your photo library so you can choose a profile photo.", cameraPermission: "OutClass uses the camera to take your profile photo.", microphonePermission: false }],
    ["expo-calendar", { calendarPermission: "OutClass adds interviews and events to your calendar when you ask it to." }],
    ["expo-notifications", { color: "#232D4B" }],
    "expo-sharing",
    "expo-audio",
    "expo-localization",
    ["expo-build-properties", { ios: { deploymentTarget: "17.0" } }],
  ],
  experiments: { reactCompiler: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? local.apiUrl ?? "https://out-class.net",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? local.supabaseUrl ?? "",
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? local.supabasePublishableKey ?? "",
    turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? local.turnstileSiteKey ?? "",
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? local.sentryDsn ?? "",
  },
});
