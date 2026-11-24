/**
 * The emailed reset link against the real expo-router: the `#token_hash=…` fragment reaches the
 * reset-password screen, which reads the same token the website would, and the root layout's
 * sign-in gate leaves that screen alone whether the phone is signed in or out.
 */
jest.unmock("expo-router");
import { renderRouter, screen } from "expo-router/testing-library";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { resetTokenFrom } from "~/lib/password-reset";

declare const __dirname: string;
const { readFileSync } = require("fs") as { readFileSync(path: string, encoding: "utf8"): string };

const TOKEN = "pkce_0123456789abcdefABCDEF";

function ResetProbe() {
  const params = useLocalSearchParams();
  return React.createElement(Text, null, `token:${resetTokenFrom(params) ?? "none"}`);
}

async function open(initialUrl: string) {
  const { Stack } = jest.requireActual("expo-router");
  return renderRouter({ _layout: () => React.createElement(Stack, null), index: () => React.createElement(Text, null, "home"), "reset-password": ResetProbe }, { initialUrl });
}

test("the link's fragment carries the token to the screen", async () => {
  await open(`/reset-password#token_hash=${TOKEN}`);
  expect(screen.getByText(`token:${TOKEN}`)).toBeTruthy();
});

test("a link without the fragment reaches the screen with no token", async () => {
  await open("/reset-password");
  expect(screen.getByText("token:none")).toBeTruthy();
});

test("the sign-in gate returns before any redirect while the reset screen is open", () => {
  const source = readFileSync(`${__dirname}/../../src/app/_layout.tsx`, "utf8");
  const exempt = source.indexOf('if (segments[0] === "reset-password") return;');
  expect(exempt).toBeGreaterThan(-1);
  expect(exempt).toBeLessThan(source.indexOf('router.replace("/sign-in")'));
  expect(exempt).toBeLessThan(source.indexOf('router.replace("/complete-profile")'));
  expect(source).toMatch(/<Stack\.Screen name="reset-password"/);
});
