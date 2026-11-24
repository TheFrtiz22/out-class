/**
 * Nov 24 stress audit of the student application journey: drafts at scale, autosave timing and data
 * loss, conflicts, submit, booking, offers, availability, calendar, tasks and profile.
 * A test named "A<n>: ..." demonstrates finding A<n> of the audit report and FAILS until it is fixed.
 * Every other test is a passing stress check of something that was verified to work.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { ApiError } from "~/lib/api";
import type { ApplicationQuestion, ApplicationsView, StudentApplication } from "~/lib/types";
import { apiState } from "./api-state";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";

type Hash = { update: (data: string, encoding: string) => { digest: (encoding: string) => string } };
const { createHash } = jest.requireActual("node:crypto") as { createHash: (algorithm: string) => Hash };

beforeEach(async () => { captureConsole(); await AsyncStorage.clear(); });
afterEach(releaseConsole);

const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const posts = (operation: string) => apiState.calls.filter(call => call.method === "POST" && call.operation === operation).map(call => call.input as { answers: { questionId: string; response: string }[]; expectedAnswers: string; clubId: string });

/** An applications view holding one draft with these questions and answers. */
function draftView(questions: ApplicationQuestion[], answers: { questionId: string; response: string }[] = [], extra: Partial<StudentApplication> = {}): ApplicationsView {
  const view = structuredClone(records.applicationsView) as ApplicationsView;
  const draft = view.applications.find(app => app.id === ids.draftApplication)!;
  draft.club = { ...draft.club, questions };
  draft.answers = answers;
  draft.profileNote = null;
  Object.assign(draft, extra);
  return view;
}
const essay = (n: number, extra: Partial<ApplicationQuestion> = {}): ApplicationQuestion => ({ id: uuid(1000 + n), prompt: `Essay question ${n}`, type: "ESSAY", required: true, options: null, wordLimit: null, ...extra } as ApplicationQuestion);
const ApplicationScreen = () => require("~/app/application/[id]").default;

// ---- Mobile API boundary limits (utils/mobile-api.ts readInput / assertBoundedInput, lib/student-applications.ts) ----
const MOBILE_BODY_LIMIT = 4_000_000; // text.length of the JSON body for applications.saveDraft/submit (lib/mobile-api/operations.ts)
const EXPECTED_ANSWERS_LIMIT = 300_000; // applicationInputSchema.expectedAnswers .max(300000)

describe("application draft at scale", () => {
  const sixty = Array.from({ length: 60 }, (_, i) => essay(i + 1, { required: i % 2 === 0 }));
  const long = (i: number) => `Answer ${i}. ` + "word ".repeat(1998); // ~10,000 characters

  test("60 questions with 10,000-character answers render, count and scroll without crashing", async () => {
    const answers = sixty.map((q, i) => ({ questionId: q.id, response: long(i) }));
    await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView(sixty, answers) } });
    expect(screen.getByTestId("draft-progress").props.children).toBe("30 of 30 required responses ready");
    expect(screen.getAllByLabelText(/^Go to question \d+$/)).toHaveLength(60);
    expect(screen.getByTestId("answer-60").props.value.length).toBeGreaterThan(9_990);
    expect(loggedCrashes()).toEqual([]);
  });

  test("A1: a 60 × 10,000-character draft is sent in a request the mobile API refuses (body > 512,000 chars, expectedAnswers > 300,000)", async () => {
    const answers = sixty.map((q, i) => ({ questionId: q.id, response: long(i) }));
    const { client } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView(sixty, answers) } });
    await fireEvent.changeText(screen.getByTestId("answer-1"), long(0) + " one more");
    await wait(950);
    await settle(client);
    const [sent] = posts("applications.saveDraft");
    expect(sent).toBeTruthy();
    // What the server would do with this body: refuse it before the action runs ("That request was not understood.").
    expect(sent!.expectedAnswers.length).toBeLessThanOrEqual(EXPECTED_ANSWERS_LIMIT);
    expect(JSON.stringify(sent).length).toBeLessThanOrEqual(MOBILE_BODY_LIMIT);
  });
});

/** The mobile API boundary as utils/mobile-api.ts applies it, then the action's own schema bound. */
const boundary = (input: unknown) => {
  const body = JSON.stringify(input);
  const expectedAnswers = (input as { expectedAnswers?: string }).expectedAnswers ?? "";
  if (body.length > MOBILE_BODY_LIMIT || expectedAnswers.length > EXPECTED_ANSWERS_LIMIT) throw new ApiError(400, "INVALID_REQUEST", "That request was not understood.");
  return { success: true, applicationId: ids.draftApplication };
};

describe("A1: long answers within the per-answer limit", () => {
  test("A1: three 90,000-character essays (each under the 100,000 cap the box allows) cannot be saved", async () => {
    const three = [essay(1), essay(2), essay(3)];
    const answers = three.map((q, i) => ({ questionId: q.id, response: `${i} ` + "x".repeat(90_000) }));
    const { client } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView(three, answers), "applications.saveDraft": boundary } });
    await fireEvent.changeText(screen.getByTestId("answer-1"), answers[0]!.response + " edit");
    await wait(950);
    await settle(client);
    // The student sees a refusal that says nothing about length, and Retry can never succeed.
    expect(screen.queryByTestId("autosave-error")).toBeNull();
    expect(screen.queryByText("That request was not understood.")).toBeNull();
  });
});

describe("autosave timing", () => {
  const sixty = Array.from({ length: 60 }, (_, i) => essay(i + 1, { required: false }));
  const answers = sixty.map((q, i) => ({ questionId: q.id, response: `Answer ${i}. ` + "word ".repeat(1998) }));

  test("typing 20 characters quickly sends one save, after the debounce, with the last text", async () => {
    const { client } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView(sixty.slice(0, 3), answers.slice(0, 3)) } });
    let text = answers[1]!.response;
    for (let i = 0; i < 20; i++) { text += "a"; await fireEvent.changeText(screen.getByTestId("answer-2"), text); await wait(40); }
    expect(posts("applications.saveDraft")).toHaveLength(0);
    await wait(950);
    await settle(client);
    expect(posts("applications.saveDraft")).toHaveLength(1);
    expect(posts("applications.saveDraft")[0]!.answers[1]!.response).toBe(text);
  });

  test("A2: each keystroke rewrites the whole draft to AsyncStorage (60 × 10,000 chars: ~600 KB per key press)", async () => {
    await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView(sixty, answers) } });
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    let text = answers[0]!.response;
    const started = Date.now();
    for (let i = 0; i < 20; i++) { text += "a"; await fireEvent.changeText(screen.getByTestId("answer-1"), text); }
    const elapsed = Date.now() - started;
    const draftWrites = () => setItem.mock.calls.filter(([key]) => String(key).startsWith("outclass:draft:"));
    // Fixed: the device copy is written at most once a second while typing, not once per key press.
    expect(draftWrites().length).toBeLessThanOrEqual(Math.ceil(elapsed / 1000) + 1);
    expect(draftWrites().length).toBeLessThan(20);
    // …and the last text is kept: on the device, or (once the debounced save lands) on the server.
    await wait(1100);
    const key = String(draftWrites().at(-1)![0]);
    const stored = await AsyncStorage.getItem(key);
    if (stored === null) expect(posts("applications.saveDraft").at(-1)!.answers[0]!.response).toBe(text);
    else expect(JSON.parse(stored).value[sixty[0]!.id]).toBe(text);
  });

  test("type, then leave the screen before the debounce: the last edit is saved", async () => {
    const { client, unmount } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView(sixty.slice(0, 2), answers.slice(0, 2)) } });
    await fireEvent.changeText(screen.getByTestId("answer-1"), "Final words before leaving");
    await wait(100);
    await act(async () => { unmount(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    await settle(client);
    expect(posts("applications.saveDraft").at(-1)!.answers[0]!.response).toBe("Final words before leaving");
  });

  test("leaving while a save is in flight still saves the newer edit after it", async () => {
    let release!: () => void;
    let first = true;
    const slow = (input: unknown) => first ? (first = false, new Promise(resolve => { release = () => resolve(boundary(input)); })) : boundary(input);
    const { client, unmount } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView(sixty.slice(0, 2), answers.slice(0, 2)), "applications.saveDraft": slow } });
    await fireEvent.changeText(screen.getByTestId("answer-1"), "first edit");
    await wait(950);
    expect(posts("applications.saveDraft")).toHaveLength(1);
    await fireEvent.changeText(screen.getByTestId("answer-1"), "second edit");
    await act(async () => { unmount(); });
    await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 20)); });
    await settle(client);
    const saves = posts("applications.saveDraft");
    expect(saves).toHaveLength(2);
    expect(saves[1]!.answers[0]!.response).toBe("second edit");
    // The second save is sent against what the first one stored, not the stale token.
    // The token is the SHA-256 of the saved answers' key (actions/applications.ts answersKeyMatches).
    const firstKey = JSON.stringify(saves[0]!.answers.filter((answer: { response: string }) => answer.response !== "").map((answer: { questionId: string; response: string }) => [answer.questionId, answer.response]).sort((a: string[], b: string[]) => a[0]!.localeCompare(b[0]!)));
    expect(saves[1]!.expectedAnswers).toBe(`sha256:${createHash("sha256").update(firstKey, "utf8").digest("hex")}`);
  });
});

describe("follow-up questions", () => {
  const team: ApplicationQuestion = { id: uuid(2001), prompt: "Which team?", type: "MULTIPLE_CHOICE", required: true, options: ["Business", "Chassis"], wordLimit: null } as ApplicationQuestion;
  const followUp: ApplicationQuestion = { id: uuid(2002), prompt: "Why business?", type: "ESSAY", required: false, options: null, wordLimit: 5, showIf: { questionId: team.id, anyOf: ["Business"] } } as ApplicationQuestion;
  const answers = [{ questionId: team.id, response: "Business" }, { questionId: followUp.id, response: "one two three four five six seven" }];

  test("A3: an over-limit answer to a follow-up that is now hidden blocks Review & submit, and its error link goes nowhere", async () => {
    await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView([team, followUp], answers) } });
    expect(screen.getByText("Why business?")).toBeTruthy();
    // Switch to Chassis: the follow-up disappears from the form.
    await fireEvent.press(screen.getByTestId("answer-1"));
    await fireEvent.press(screen.getByLabelText("Chassis"));
    expect(screen.queryByText("Why business?")).toBeNull();
    await fireEvent.press(screen.getByTestId("draft-review"));
    // Every visible question is answered, so the student should be asked to confirm, not told to fix a question they can't see.
    expect(screen.queryByText(/Why business\?: Keep your answer within 5 words/)).toBeNull();
    expect(screen.getByText("Ready to send your application?")).toBeTruthy();
  });
});

describe("conflicts and submit", () => {
  const two = [essay(1), essay(2, { required: false })];
  const stored = [{ questionId: two[0]!.id, response: "Saved on the laptop" }];

  test("a save refused because another device changed the draft shows the newer version and keeps this copy readable", async () => {
    let reads = 0;
    const view = () => (reads++ === 0 ? draftView(two, stored) : draftView(two, [{ questionId: two[0]!.id, response: "Edited on the laptop later" }]));
    const conflict = () => { throw new ApiError(409, "CONFLICT", "This application changed in another tab. Your responses are retained. Reopen it to compare before saving."); };
    const { client } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": view, "applications.saveDraft": conflict } });
    await fireEvent.changeText(screen.getByTestId("answer-1"), "Typed on the phone");
    await wait(950);
    await settle(client);
    await wait(20);
    expect(screen.getByTestId("autosave-conflict")).toBeTruthy();
    expect(screen.getByTestId("answer-1").props.value).toBe("Edited on the laptop later");
    await fireEvent.press(screen.getByTestId("autosave-review-copy"));
    expect(screen.getByText(/Typed on the phone/)).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("double-tapping Submit application sends one submission", async () => {
    let submitted = false;
    const view = () => { const v = draftView(two, stored); if (submitted) v.applications.find(a => a.id === ids.draftApplication)!.status = "SUBMITTED"; return v; };
    const submit = (input: unknown) => { submitted = true; return boundary(input); };
    const { client } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": view, "applications.submit": submit } });
    await fireEvent.press(screen.getByTestId("draft-review"));
    await fireEvent.press(screen.getByTestId("draft-review"));
    const accept = screen.getByTestId("confirm-accept");
    await fireEvent.press(accept);
    await fireEvent.press(accept);
    await settle(client);
    expect(posts("applications.submit")).toHaveLength(1);
    expect(loggedCrashes()).toEqual([]);
  });

  test("a 60-question form with every type validates required, choice, select-all and link answers like the web", async () => {
    const qs: ApplicationQuestion[] = Array.from({ length: 60 }, (_, i) => {
      const kind = i % 4;
      return { id: uuid(3000 + i), prompt: `Q${i + 1}`, required: true, wordLimit: kind === 0 ? 3 : null,
        type: (["ESSAY", "MULTIPLE_CHOICE", "MULTI_SELECT", "FILE_UPLOAD"] as const)[kind], options: kind === 1 || kind === 2 ? ["A", "B", "C"] : null } as ApplicationQuestion;
    });
    const valid = qs.map((q, i) => ({ questionId: q.id, response: i % 4 === 0 ? "one two three" : i % 4 === 1 ? "B" : i % 4 === 2 ? JSON.stringify(["A", "C"]) : "docs.google.com/document/d/abc" }));
    await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView(qs, valid) } });
    expect(screen.getByTestId("draft-progress").props.children).toBe("60 of 60 required responses ready");
    await fireEvent.changeText(screen.getByTestId("answer-1"), "one two three four");
    expect(screen.getByTestId("draft-progress").props.children).toBe("59 of 60 required responses ready");
    expect(loggedCrashes()).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
describe("applications list at scale", () => {
  test("100 applications across the four stages: each tab lists exactly its stage's applications", async () => {
    const base = records.applicationsView.applications;
    const apps = Array.from({ length: 100 }, (_, i) => ({ ...structuredClone(base[i % 4]!), id: uuid(5000 + i), club: { ...base[i % 4]!.club, name: `Club ${String(i).padStart(3, "0")}` } }));
    const counts = { drafts: 25, "in-review": 25, interviews: 25, decisions: 25 };
    const view: ApplicationsView = { ...records.applicationsView, applications: apps, stages: records.applicationsView.stages.map(stage => ({ ...stage, count: counts[stage.id as keyof typeof counts] })) };
    await renderRoute(require("~/app/applications").default, { overrides: { "applications.view": view } });
    for (const stage of ["drafts", "in-review", "interviews", "decisions"]) {
      await fireEvent.press(screen.getByTestId(`applications-tab-${stage}`));
      await wait(460);
      expect(screen.getByTestId("applications-screen").props.data).toHaveLength(25);
    }
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("interview booking", () => {
  test("a time someone else just took: the refusal shows and the times are re-read", async () => {
    const taken = () => { throw new ApiError(409, "CONFLICT", "That time was just booked. Choose another time."); };
    const { client } = await renderRoute(require("~/app/interview/[applicationId]").default, { params: { applicationId: ids.interviewApplication }, overrides: { "interviews.reserve": taken } });
    const before = apiState.calls.filter(call => call.operation === "interviews.schedule").length;
    await fireEvent.press(screen.getAllByTestId("interview-slot")[0]!);
    await fireEvent.press(screen.getByTestId("confirm-accept"));
    await settle(client);
    expect(screen.getByTestId("interview-error").props.children).toBe("That time was just booked. Choose another time.");
    expect(apiState.calls.filter(call => call.operation === "interviews.schedule").length).toBeGreaterThan(before);
  });

  test("double-tapping Confirm interview reserves once", async () => {
    const { client } = await renderRoute(require("~/app/interview/[applicationId]").default, { params: { applicationId: ids.interviewApplication } });
    await fireEvent.press(screen.getAllByTestId("interview-slot")[0]!);
    const accept = screen.getByTestId("confirm-accept");
    await fireEvent.press(accept);
    await fireEvent.press(accept);
    await settle(client);
    expect(apiState.calls.filter(call => call.operation === "interviews.reserve")).toHaveLength(1);
  });

  test("Eastern labels across the Nov 1 2026 DST change and the 8 AM / 9 PM edges", () => {
    const { slotTime, dayKey } = require("~/components/applications/format");
    expect(slotTime("2026-10-31T12:00:00Z")).toBe("8:00 AM"); // EDT
    expect(slotTime("2026-11-01T13:00:00Z")).toBe("8:00 AM"); // EST
    expect(slotTime("2026-11-02T02:00:00Z")).toBe("9:00 PM");
    expect(dayKey("2026-11-02T04:30:00Z")).toBe("2026-11-01"); // 11:30 PM EST is still Nov 1
  });
});

describe("offer response", () => {
  test("double-tapping Accept Offer in the confirm sheet responds once", async () => {
    const { client } = await renderRoute(require("~/app/decision/[applicationId]").default, { params: { applicationId: ids.decidedApplication } });
    await fireEvent.press(screen.getByTestId("offer-accept"));
    const accept = screen.getByTestId("confirm-accept");
    await fireEvent.press(accept);
    await fireEvent.press(accept);
    await settle(client);
    expect(apiState.calls.filter(call => call.operation === "offers.respond")).toHaveLength(1);
    expect(screen.getByTestId("decision-message")).toBeTruthy();
  });
});

describe("availability at scale", () => {
  test("every visible slot of every day painted saves one 8 AM–9 PM range per day", async () => {
    const { client } = await renderRoute(require("~/app/settings/availability").default);
    await fireEvent.press(screen.getByTestId("availability-day-0"));
    await fireEvent.press(screen.getByTestId("availability-clear-day"));
    for (let hour = 32; hour < 84; hour += 4) await fireEvent.press(screen.getByTestId(`availability-grid-hour-${hour}`));
    await fireEvent.press(screen.getByTestId("availability-copy-day"));
    for (let day = 1; day < 7; day++) await fireEvent.press(screen.getByTestId(`availability-copy-to-${day}`));
    await fireEvent.press(screen.getByTestId("availability-copy-confirm"));
    await wait(950);
    await settle(client);
    const saved = apiState.calls.filter(call => call.operation === "availability.save").at(-1)!.input as { schedule: { weekly: number[][][] } };
    expect(saved.schedule.weekly.map(day => day.filter(([a, b]) => a >= 480 && b <= 1260))).toEqual(Array(7).fill([[480, 1260]]));
    expect(screen.getByTestId("availability-day-summary").props.children.join("")).toContain("13 hours");
    expect(loggedCrashes()).toEqual([]);
  });

  test("a legacy-zone schedule edited in the DST week (Sun Nov 1 2026) reads back exactly as painted", () => {
    const av = require("~/lib/availability");
    const schedule = { ...av.emptySchedule("America/Los_Angeles"), weeklySubmitted: true };
    const week = "2026-10-26";
    const days = av.availabilityEditorDays(schedule, week, false).map(() => Array.from({ length: 96 }, (_, slot) => slot >= 32 && slot < 84));
    const next = av.editAvailabilityDays(schedule, week, false, days, [0, 1, 2, 3, 4, 5, 6]);
    const back = av.availabilityEditorDays(next, week, false);
    for (let day = 0; day < 7; day++) expect(back[day].slice(32, 84).every(Boolean)).toBe(true);
  });
});

describe("calendar tab at scale", () => {
  const events = Array.from({ length: 300 }, (_, i) => {
    const start = new Date(Date.now() + (i % 30) * 86_400_000 + 3_600_000);
    return { id: `meeting-${uuid(6000 + i)}`, clubId: ids.memberClub, startTime: start.toISOString(), endTime: new Date(+start + 3_600_000).toISOString(), date: require("~/lib/eastern").easternDateKey(start), day: 1, time: "", title: `Event ${i}`, club: "Virginia Motorsports", color: "#E57200", type: "Other", durationMinutes: 60 };
  });

  test("300 events: agenda groups and the month view render without crashing", async () => {
    await renderRoute(require("~/app/(tabs)/calendar").default, { overrides: { "calendar.view": { generatedAt: new Date().toISOString(), events } } });
    expect(screen.getAllByText(/^(Today|Tomorrow)$/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("calendar-event-meeting").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText("Month"));
    expect(loggedCrashes()).toEqual([]);
  });

  test("A4: Add to Calendar in the event sheet opens the system sheet again on a second tap while the first is still opening", async () => {
    const Calendar = jest.requireMock("expo-calendar") as { createEventInCalendarAsync: jest.Mock };
    let finish!: () => void;
    Calendar.createEventInCalendarAsync.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ action: "saved" }); }));
    await renderRoute(require("~/app/(tabs)/calendar").default, { overrides: { "calendar.view": { generatedAt: new Date().toISOString(), events: events.slice(0, 3) } } });
    await fireEvent.press(screen.getAllByTestId("calendar-event-meeting")[0]!);
    await fireEvent.press(screen.getByTestId("calendar-add"));
    await wait(500); // past the 450 ms double-tap guard; Android can take seconds to show the event editor
    await fireEvent.press(screen.getByTestId("calendar-add"));
    await act(async () => { finish(); });
    expect(Calendar.createEventInCalendarAsync).toHaveBeenCalledTimes(1);
    Calendar.createEventInCalendarAsync.mockReset();
    Calendar.createEventInCalendarAsync.mockImplementation(async () => ({ action: "saved", id: "event-id" }));
  });
});

describe("tasks at scale", () => {
  test("200 tasks in one club: every active task is listed", async () => {
    const workspace = (input: unknown) => {
      const clubId = (input as { clubId: string }).clubId;
      const memberId = clubId === ids.leaderClub ? ids.leaderMembership : ids.memberMembership;
      return { clubId, manage: false, memberId, tasks: clubId !== ids.memberClub ? [] : Array.from({ length: 200 }, (_, i) => ({
        id: uuid(7000 + i), clubId, kind: "TASK", projectId: null, project: null, title: `Task ${i}`, description: null, status: "OPEN", dueAt: new Date(Date.now() + (i - 50) * 3_600_000).toISOString(), createdAt: new Date().toISOString(), requirements: ["TEXT"], resources: null, revision: 1,
        assignments: [{ id: uuid(8000 + i), taskId: uuid(7000 + i), memberId, submittedAt: i % 5 === 0 ? new Date().toISOString() : null, text: null, link: null, feedback: null, reviewedAt: null, revisionRequestedAt: null, viewedAt: null, revision: 1, files: [], groupLabel: null }],
      })) };
    };
    await renderRoute(require("~/app/tasks").default, { overrides: { "tasks.workspace": workspace } });
    expect(screen.getAllByTestId(/^task-row-/)).toHaveLength(160); // 40 of 200 are submitted, so not active
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("network", () => {
  test("offline while typing: the edit stays on the device, Retry after reconnecting saves it", async () => {
    let offline = true;
    const save = (input: unknown) => { if (offline) throw new ApiError(0, "OFFLINE", "You're offline. Check your connection and try again."); return boundary(input); };
    const { client } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: { "applications.view": draftView([essay(1)]), "applications.saveDraft": save } });
    await fireEvent.changeText(screen.getByTestId("answer-1"), "Written on the train");
    await wait(950);
    await settle(client);
    expect(screen.getByTestId("autosave-offline")).toBeTruthy();
    const key = (await AsyncStorage.getAllKeys()).find(item => item.startsWith("outclass:draft:"));
    expect(JSON.parse((await AsyncStorage.getItem(key!))!).value).toMatchObject({ [essay(1).id]: "Written on the train" });
    offline = false;
    await fireEvent.press(screen.getByTestId("autosave-retry"));
    await settle(client);
    expect(screen.getByTestId("autosave-saved")).toBeTruthy();
    expect(posts("applications.saveDraft").at(-1)!.answers[0]!.response).toBe("Written on the train");
  });

  test("error mode: the application screen shows the refusal, not a blank form", async () => {
    await renderRoute(ApplicationScreen(), { mode: "error", params: { id: ids.draftApplication } });
    expect(screen.getByText(/test refusal/)).toBeTruthy();
    expect(screen.queryByTestId("draft-review")).toBeNull();
  });
});
