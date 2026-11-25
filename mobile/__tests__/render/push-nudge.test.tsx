/**
 * Push is opt-in on this phone (mobile/src/lib/push.ts asks only when the student turns it on), so a
 * student who has just submitted is offered it once, where it matters: the club's reply comes later.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import type { ApplicationQuestion, ApplicationsView } from "~/lib/types";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";

jest.mock("~/lib/push", () => {
  const actual = jest.requireActual("~/lib/push");
  return { ...actual, push: { status: jest.fn(async () => "off"), enable: jest.fn(async () => true), disable: jest.fn(async () => {}) } };
});
const { push } = jest.requireMock("~/lib/push") as { push: { status: jest.Mock; enable: jest.Mock } };

beforeEach(() => { captureConsole(); push.status.mockReset(); push.enable.mockReset(); });
afterEach(releaseConsole);

const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const question = { id: "00000000-0000-4000-8000-000000009001", prompt: "Why this club?", type: "ESSAY", required: true, options: null, wordLimit: null } as ApplicationQuestion;
const ApplicationScreen = () => require("~/app/application/[id]").default;

/** A draft with one answered question that becomes SUBMITTED once applications.submit is called. */
function submittable() {
  let submitted = false;
  const view = () => {
    const v = structuredClone(records.applicationsView) as ApplicationsView;
    const draft = v.applications.find(app => app.id === ids.draftApplication)!;
    draft.club = { ...draft.club, questions: [question] };
    draft.answers = [{ questionId: question.id, response: "Because I want to build things." }];
    draft.profileNote = null;
    if (submitted) draft.status = "SUBMITTED";
    return v;
  };
  return { "applications.view": view, "applications.submit": () => { submitted = true; return { success: true, applicationId: ids.draftApplication }; } };
}

async function submit() {
  const { client } = await renderRoute(ApplicationScreen(), { params: { id: ids.draftApplication }, overrides: submittable() });
  await fireEvent.press(screen.getByTestId("draft-review"));
  await fireEvent.press(screen.getByTestId("confirm-accept"));
  await settle(client);
  await wait(20);
  return client;
}

describe("after submitting, the app offers push once", () => {
  test("push off on this phone: the offer shows, and Turn on notifications turns it on", async () => {
    push.status.mockResolvedValue("off");
    push.enable.mockResolvedValue(true);
    await submit();
    expect(screen.getByTestId("application-notice")).toBeTruthy();
    expect(screen.getByTestId("push-nudge")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("push-nudge-enable"));
    await wait(20);
    expect(push.enable).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("push-nudge")).toBeNull();
    expect(screen.getByTestId("push-nudge-on")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("Not now hides the offer without asking for permission", async () => {
    push.status.mockResolvedValue("off");
    await submit();
    await fireEvent.press(screen.getByTestId("push-nudge-dismiss"));
    expect(screen.queryByTestId("push-nudge")).toBeNull();
    expect(push.enable).not.toHaveBeenCalled();
    // Leaving for the submitted responses and coming back does not bring it back.
    await fireEvent.press(screen.getByTestId("application-view-responses"));
    await fireEvent.press(screen.getByTestId("application-view-status"));
    await wait(20);
    expect(screen.queryByTestId("push-nudge")).toBeNull();
  });

  test("a phone that did not turn on says so and keeps the offer", async () => {
    push.status.mockResolvedValue("off");
    push.enable.mockResolvedValue(false);
    await submit();
    await fireEvent.press(screen.getByTestId("push-nudge-enable"));
    await wait(20);
    expect(screen.getByTestId("push-nudge-failed")).toBeTruthy();
    expect(screen.getByTestId("push-nudge")).toBeTruthy();
  });

  test.each(["on", "denied", "unavailable"])("push %s: no offer", async status => {
    push.status.mockResolvedValue(status);
    await submit();
    expect(screen.getByTestId("application-notice")).toBeTruthy();
    expect(screen.queryByTestId("push-nudge")).toBeNull();
  });

  test("opening an already-submitted application makes no offer", async () => {
    push.status.mockResolvedValue("off");
    await renderRoute(ApplicationScreen(), { params: { id: ids.reviewApplication } });
    await wait(20);
    expect(screen.queryByTestId("push-nudge")).toBeNull();
    expect(push.status).not.toHaveBeenCalled();
  });
});
