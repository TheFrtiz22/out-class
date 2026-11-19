import { ApiError } from "~/lib/api";
import { fixtureSets, type Fixture, type FixtureSet } from "./fixtures";

export type ApiMode = "rich" | "empty" | "error";
/** A route param the server would refuse (not a uuid); inputs that carry it get a 400. */
export const BAD_PARAM = "not-a-real-id";
type Call = { method: "GET" | "POST"; operation: string; input: unknown };

/** What the mocked `api.get/post` answers: the fixture set for the mode, with per-test overrides. */
export const apiState = {
  mode: "rich" as ApiMode,
  overrides: {} as FixtureSet,
  calls: [] as Call[],
  missing: new Set<string>(),
  /** Refuse inputs with an undefined value, as the uuid schemas refuse a missing id (route-param tests only). */
  strictInputs: false,
};

export const ERROR_MESSAGE = "You don't have access to this right now (test refusal).";

export function resetApi(mode: ApiMode = "rich", overrides: FixtureSet = {}, strictInputs = false) {
  apiState.mode = mode;
  apiState.strictInputs = strictInputs;
  apiState.overrides = overrides;
  apiState.calls = [];
  apiState.missing = new Set();
}

function answer(fixture: Fixture, input: unknown): unknown {
  const value = typeof fixture === "function" ? fixture(input) : fixture;
  return value === undefined ? undefined : structuredClone(value);
}

export function resolveFixture(method: "GET" | "POST", operation: string, input: unknown): Promise<unknown> {
  apiState.calls.push({ method, operation, input });
  if (operation in apiState.overrides) {
    const fixture = apiState.overrides[operation];
    try { return Promise.resolve(answer(fixture, input)); } catch (error) { return Promise.reject(error); }
  }
  // The operations' zod schemas refuse ids that are not uuids, and missing required ids.
  if (input && typeof input === "object" && !(input instanceof FormData) && Object.values(input).some(value => value === BAD_PARAM || (apiState.strictInputs && value === undefined)))
    return Promise.reject(new ApiError(400, "INVALID_INPUT", "That link isn’t valid."));
  // A refusal (403): the query client does not retry these, so error states show at once.
  if (apiState.mode === "error") return Promise.reject(new ApiError(403, "FORBIDDEN", ERROR_MESSAGE));
  const set = fixtureSets[apiState.mode];
  const fixture = operation in set ? set[operation] : fixtureSets.rich[operation];
  if (fixture === undefined) {
    apiState.missing.add(`${method} ${operation}`);
    return Promise.reject(new ApiError(404, "NO_FIXTURE", `No fixture for ${operation}`));
  }
  try { return Promise.resolve(answer(fixture, input)); } catch (error) { return Promise.reject(error); }
}
