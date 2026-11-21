/** Render tests (`pnpm test:render`): every route in src/app rendered in Node against fixtures. */
const transformable = [
  "(jest-)?react-native", "@react-native(-community)?", "expo(nent)?", "@expo(nent)?", "@expo-google-fonts", "expo-.*",
  "react-native-.*", "@react-navigation", "phosphor-react-native", "@outclass", "@sentry",
].join("|");

module.exports = {
  preset: "jest-expo/ios",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts?(x)"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/render/setup.tsx"],
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/src/$1",
    "^phosphor-react-native/src/icons/.*$": "<rootDir>/__tests__/render/icon-stub.js",
  },
  // pnpm keeps packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>: let the
  // first segment through and decide on the package's own name.
  transformIgnorePatterns: [`/node_modules/(?!(\\.pnpm|${transformable})(/|$))`, "/node_modules/react-native-reanimated/plugin/", "/node_modules/@react-native/babel-preset/"],
  testTimeout: 20000,
};
