/**
 * The screens brought into the app tonight (Interests, Availability, Interview schedule, the task page)
 * take every colour from the theme: in Dark none of them shows a light-mode
 * text or surface colour, and nothing crashes in either appearance.
 */
import { resolveTheme } from "@outclass/shared/tokens";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act } from "@testing-library/react-native";
import type { ComponentType } from "react";
import { ids } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";

beforeEach(async () => { captureConsole(); await AsyncStorage.clear(); });
afterEach(async () => { releaseConsole(); await AsyncStorage.clear(); });

const light = resolveTheme("light").colors as unknown as Record<string, string>;
const dark = resolveTheme("dark").colors as unknown as Record<string, string>;
/** Colours only the light theme uses (Dark uses some of the same values for other roles): none should appear in Dark. */
const darkValues = new Set(Object.values(dark).filter(value => typeof value === "string").map(value => value.toLowerCase()));
const lightValues = new Set(Object.values(light).filter(value => typeof value === "string").map(value => value.toLowerCase()));
const darkOnly = (found: string[]) => found.some(colour => darkValues.has(colour) && !lightValues.has(colour));
const lightOnly = new Set(Object.values(light).filter(value => typeof value === "string").map(value => value.toLowerCase()).filter(value => !darkValues.has(value)));

type Json = { props?: Record<string, unknown>; children?: (Json | string)[] | null } | string | null;
function colours(node: Json | Json[], into: string[] = []): string[] {
  if (!node || typeof node === "string") return into;
  if (Array.isArray(node)) { node.forEach(child => colours(child, into)); return into; }
  const style = [node.props?.style].flat(Infinity as 1).filter(Boolean) as Record<string, unknown>[];
  for (const part of style) for (const key of ["color", "backgroundColor", "borderColor"]) if (typeof part[key] === "string") into.push((part[key] as string).toLowerCase());
  (node.children ?? []).forEach(child => colours(child, into));
  return into;
}

const screens: { name: string; load: () => ComponentType; params?: Record<string, string> }[] = [
  { name: "Interests", load: () => require("~/app/settings/interests").default },
  { name: "Availability", load: () => require("~/app/settings/availability").default },
  { name: "Interview schedule", load: () => require("~/app/settings/interviews").default },
  { name: "Task with files", load: () => require("~/app/task/[assignmentId]").default, params: { assignmentId: ids.assignment, clubId: ids.memberClub } },
];

describe.each(["light", "dark"] as const)("%s appearance", appearance => {
  test.each(screens.map(item => [item.name, item] as const))("%s renders with theme colours only", async (_name, item) => {
    await AsyncStorage.setItem("outclass.appearance", appearance);
    const { toJSON } = await renderRoute(item.load(), { params: item.params });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const found = colours(toJSON() as Json);
    if (appearance === "dark") {
      expect(darkOnly(found)).toBe(true); // the screen really is in Dark
      expect(found.filter(colour => lightOnly.has(colour))).toEqual([]);
    }
    expect(loggedCrashes()).toEqual([]);
  });
});
