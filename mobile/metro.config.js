// Expo's own Metro defaults (monorepo aware), plus one fix.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @sentry/react-native looks for Expo Router's old internal store (a guarded require, for route names
// on performance traces, which the app doesn't collect). Expo Router 58 no longer has that file, so
// Metro warned about it on every start; resolve it to nothing, which is what Sentry falls back to.
const MISSING = new Set(["expo-router/build/global-state/router-store"]);
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (MISSING.has(moduleName)) return { type: "empty" };
  return resolveRequest ? resolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
