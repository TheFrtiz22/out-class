import type { getTaskWorkspace } from "@/actions/tasks";
import { taskAudienceSchema } from "@/lib/tasks";
type Task = Awaited<ReturnType<typeof getTaskWorkspace>>["tasks"][number];
export function seedTasks(
  clubId: string,
  members: {
    id: string;
    groups: string[];
    cohort: string | null;
    role: "PRESIDENT" | "RECRUITMENT_LEAD" | "GENERAL_MEMBER";
    user: {
      id: string;
      email: string;
      studentProfile: { firstName: string; lastName: string; gradYear: number };
    };
  }[],
  anchor: string,
): Task[] {
  const time = +new Date(anchor + "T12:00:00Z");
  const id = (n: number) =>
    `aabbccdd-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return [
    "Fall investment research project",
    "Weekly market brief",
    "Draft an investment thesis",
    "Peer review: risk assumptions",
  ].map((title, i) => ({
    id: id(i),
    clubId,
    title,
    description: [
      "Fictional MII semester project: collaborate on a research thesis, test assumptions, and present a thoughtful recommendation.",
      "Share one market development, why it matters, and a source. Fictional demo assignment.",
      "Prepare an initial thesis and identify the evidence that could disprove it.",
      "Read your team's thesis and submit constructive feedback on the key risks.",
    ][i],
    assigneeId: null,
    kind: i === 0 ? "PROJECT" : "TASK",
    projectId: i > 1 ? id(0) : null,
    status: "OPEN",
    dueAt: new Date(
      time + (i === 0 ? 40 : i === 1 ? 3 : i === 2 ? -2 : 7) * 86400000,
    ),
    createdAt: new Date(time - 5 * 86400000),
    revision: 0,
    resources: [
      {
        label: "UVA Library research resources",
        url: "https://www.library.virginia.edu",
      },
    ],
    requirements: i === 0 ? [] : ["TEXT"],
    audience: taskAudienceSchema.parse(
      i < 2
        ? { everyone: true }
        : i === 2
          ? { groups: ["Equity research"] }
          : { cohorts: ["Fall 2026"] },
    ),
    assignments: members
      .filter(
        (m) =>
          i < 2 ||
          (i === 2 && m.groups.includes("Equity research")) ||
          (i === 3 && m.cohort === "Fall 2026"),
      )
      .map((member, j) => ({
        id: id(100 + i * 30 + j),
        taskId: id(i),
        memberId: member.id,
        userId: member.user.id,
        member,
        assignedAt: new Date(time - 5 * 86400000),
        viewedAt: j % 3 ? new Date(time - 86400000) : null,
        text:
          i > 0 && j % 3 === 1
            ? "Fictional submission: rates and earnings expectations remain the key drivers. I would revisit the thesis if operating margins weakened for two consecutive quarters."
            : "",
        link: i > 0 && j % 3 === 1 ? "https://www.virginia.edu" : "",
        files: [],
        submittedAt: i > 0 && j % 3 === 1 ? new Date(time - 86400000) : null,
        reviewedAt: i > 0 && j % 3 === 1 && j % 4 === 1 ? new Date(time) : null,
        reviewedBy: i > 0 && j % 3 === 1 && j % 4 === 1 ? "demo-manager" : null,
        feedback:
          i > 0 && j % 3 === 1 && j % 4 === 1
            ? "Sample feedback: clear reasoning. Bring the downside scenario to our next meeting."
            : "",
        revision: 0,
      })),
  }));
}
