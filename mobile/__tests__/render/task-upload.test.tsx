/**
 * Task files are added in the app the way the web adds them (components/club-tasks.tsx): the server
 * records each file and returns a one-time address, the bytes go there, and the submission carries
 * the new file ids.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import { ApiError } from "~/lib/api";
import type { TaskWorkspace } from "~/lib/types";
import { apiState } from "./api-state";
import { fixtureSets, ids } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";

beforeEach(captureConsole);
afterEach(releaseConsole);

const Picker = jest.requireMock("expo-document-picker") as { getDocumentAsync: jest.Mock };
const Screen = () => require("~/app/task/[assignmentId]").default;
const params = { assignmentId: ids.assignment, clubId: ids.memberClub };
const pdf = { uri: "file:///cache/cad-review.pdf", name: "cad-review.pdf", size: 120_000, mimeType: "application/pdf" };
/** The rich fixture's task at a given assignment revision, needing only a file. */
const fileTask = (revision: () => number) => (input: unknown) => {
  const workspace = (fixtureSets.rich["tasks.workspace"] as (input: unknown) => TaskWorkspace)(input);
  workspace.tasks[0] = { ...workspace.tasks[0]!, requirements: ["FILE"], assignments: workspace.tasks[0]!.assignments.map(item => ({ ...item, revision: revision(), reviewedAt: null })) };
  return workspace;
};
const posts = (operation: string) => apiState.calls.filter(call => call.method === "POST" && call.operation === operation).map(call => call.input as Record<string, unknown>);
let fetchMock: jest.Mock;
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = jest.fn(async (url: string, init?: { method?: string }) => init?.method === "PUT" ? { ok: true } : { blob: async () => ({ size: url.includes("big") ? 11 * 1024 * 1024 : 120_000 }) });
  globalThis.fetch = fetchMock as never;
});
afterEach(() => { globalThis.fetch = realFetch; Picker.getDocumentAsync.mockReset(); Picker.getDocumentAsync.mockImplementation(async () => ({ canceled: true, assets: null })); });

describe("task file upload", () => {
  test("uploads a picked file to its one-time address and submits it with the task", async () => {
    Picker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [pdf] });
    const { client } = await renderRoute(Screen(), { params });
    expect(screen.queryByText("Open on web")).toBeNull();
    await fireEvent.press(screen.getByTestId("task-add-files"));
    await settle(client);
    expect(posts("tasks.upload")).toEqual([{ assignmentId: ids.assignment, name: "cad-review.pdf", size: 120_000, mime: "application/pdf" }]);
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(put[0]).toBe("https://storage.out-class.test/upload/sign");
    expect(put[1].headers).toEqual({ "Content-Type": "application/pdf", "x-upsert": "false" });
    expect(screen.getByText(/cad-review\.pdf · 118 KB · Not submitted yet/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("task-link"), "https://example.edu/cad");
    await fireEvent.press(screen.getByTestId("task-submit"));
    await settle(client);
    expect(posts("tasks.submit").at(-1)).toMatchObject({ assignmentId: ids.assignment, link: "https://example.edu/cad", fileIds: [expect.any(String)] });
    expect(loggedCrashes()).toEqual([]);
  });

  test("a required file is asked for before submitting", async () => {
    await renderRoute(Screen(), { params });
    await fireEvent.changeText(screen.getByTestId("task-link"), "https://example.edu/cad");
    await fireEvent.press(screen.getByTestId("task-submit"));
    expect(screen.getByText("Add a file before submitting.")).toBeTruthy();
    expect(posts("tasks.submit")).toEqual([]);
  });

  test("a file type the web refuses is not uploaded", async () => {
    Picker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///cache/photo.heic", name: "photo.heic", size: 2000, mimeType: "image/heic" }] });
    const { client } = await renderRoute(Screen(), { params });
    await fireEvent.press(screen.getByTestId("task-add-files"));
    await settle(client);
    expect(screen.getByText("photo.heic isn’t a PDF, image, text, or Office document.")).toBeTruthy();
    expect(posts("tasks.upload")).toEqual([]);
  });

  test("a file over 10 MB is not uploaded", async () => {
    Picker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///cache/big.pdf", name: "big.pdf", size: 11 * 1024 * 1024, mimeType: "application/pdf" }] });
    const { client } = await renderRoute(Screen(), { params });
    await fireEvent.press(screen.getByTestId("task-add-files"));
    await settle(client);
    expect(screen.getByText("big.pdf is over 10 MB.")).toBeTruthy();
    expect(posts("tasks.upload")).toEqual([]);
  });

  test("more than five files at once is refused", async () => {
    Picker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: Array.from({ length: 6 }, (_, i) => ({ ...pdf, name: `f${i}.pdf` })) });
    const { client } = await renderRoute(Screen(), { params });
    await fireEvent.press(screen.getByTestId("task-add-files"));
    await settle(client);
    expect(screen.getByText("Choose up to five files.")).toBeTruthy();
  });

  test("a failed transfer says so and adds nothing", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => init?.method === "PUT" ? { ok: false } : { blob: async () => ({ size: 120_000 }) });
    Picker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [pdf] });
    const { client } = await renderRoute(Screen(), { params });
    await fireEvent.press(screen.getByTestId("task-add-files"));
    await settle(client);
    expect(screen.getByText("Upload failed. Please try again.")).toBeTruthy();
    expect(screen.queryByText(/cad-review\.pdf/)).toBeNull();
  });

  test("a new file can be removed before submitting", async () => {
    Picker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [pdf] });
    const { client } = await renderRoute(Screen(), { params });
    await fireEvent.press(screen.getByTestId("task-add-files"));
    await settle(client);
    const row = screen.getAllByTestId(/^task-file-remove-/)[0]!;
    await act(async () => { await fireEvent.press(row); });
    expect(screen.queryByText(/cad-review\.pdf/)).toBeNull();
  });

  test("a new upload survives the task changing elsewhere, and is still sent with the next submit", async () => {
    let revision = 1;
    Picker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [pdf] });
    const { client } = await renderRoute(Screen(), {
      params,
      overrides: {
        "tasks.workspace": fileTask(() => revision),
        "tasks.submit": (input: unknown) => {
          if ((input as { revision: number }).revision !== revision) throw new ApiError(422, "STALE", "This submission changed or was reviewed. Reload the page and try again.");
          return { success: true };
        },
      },
    });
    await fireEvent.press(screen.getByTestId("task-add-files"));
    await settle(client);
    revision = 2; // A reviewer changed it on the web.
    await fireEvent.press(screen.getByTestId("task-submit"));
    await settle(client);
    expect(screen.getByTestId("task-stale")).toBeTruthy();
    expect(screen.getByText(/cad-review\.pdf · 118 KB · Not submitted yet/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("task-submit"));
    await settle(client);
    expect(posts("tasks.submit").at(-1)).toMatchObject({ revision: 2, fileIds: [expect.any(String)] });
    expect(screen.getByTestId("task-saved")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("a second submit before the reload uses the raised revision, not the old one", async () => {
    let revision = 1;
    const { client } = await renderRoute(Screen(), {
      params,
      overrides: {
        // The reload never arrives with the new revision (say it failed), so the form keeps its first copy.
        "tasks.workspace": fileTask(() => 1),
        "tasks.submit": (input: unknown) => {
          if ((input as { revision: number }).revision !== revision) throw new ApiError(422, "STALE", "This submission changed or was reviewed. Reload the page and try again.");
          revision += 1;
          return { success: true };
        },
      },
    });
    Picker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [pdf] });
    await fireEvent.press(screen.getByTestId("task-add-files"));
    await settle(client);
    await fireEvent.press(screen.getByTestId("task-submit"));
    await settle(client);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 500)); });
    await fireEvent.press(screen.getByTestId("task-submit"));
    await settle(client);
    expect(posts("tasks.submit").map(call => call.revision)).toEqual([1, 2]);
    expect(screen.queryByTestId("task-stale")).toBeNull();
    expect(screen.getByTestId("task-saved")).toBeTruthy();
    expect(screen.getByText(/cad-review\.pdf · 118 KB$/)).toBeTruthy();
  });
});
