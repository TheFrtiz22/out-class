import { requirePlatformAdmin } from "@/utils/platform-admin";
import { redirect } from "next/navigation";
import { platformViewSession } from "@/utils/platform-view-as";
import { prisma } from "@/utils/prisma";
import { hasPermission } from "@/lib/permissions";
export default async function Page() {
  try {
    await requirePlatformAdmin({ allowViewAs: true });
  } catch {
    redirect("/platform/login");
  }
  const session = await platformViewSession().catch(() => null);
  if (!session)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="font-display text-3xl">View session unavailable</h1>
        <p className="mt-4">
          The view has expired or your administrator access has changed. Exit
          using the banner to restore your original session.
        </p>
        <a className="mt-4 block underline" href="/platform/login">
          Administrator sign-in
        </a>
      </main>
    );
  const user = await prisma.user.findUnique({
    where: { id: session.targetUserId },
    select: {
      id: true,
      email: true,
      disabledAt: true,
      studentProfile: {
        select: {
          firstName: true,
          lastName: true,
          major: true,
          gradYear: true,
          bio: true,
          experiences: {
            select: { title: true, subtitle: true, period: true },
          },
        },
      },
      memberships: {
        select: {
          id: true,
          clubId: true,
          isOwner: true,
          permissions: true,
          club: { select: { name: true } },
        },
      },
      applications: {
        select: { id: true, status: true, club: { select: { name: true } } },
      },
    },
  });
  if (!user || user.disabledAt)
    return (
      <main className="p-6">
        This account is no longer available. Exit view-as to continue.
      </main>
    );
  const member = user.memberships.find((m) => m.clubId === session.clubId);
  if (session.clubId && !member)
    return (
      <main className="p-6">
        The user's club membership was removed. Exit view-as to continue.
      </main>
    );
  const meetings = member
    ? await prisma.meeting.findMany({
        where: { clubId: member.clubId },
        select: { id: true, title: true, date: true, audience: true },
        orderBy: { date: "desc" },
        take: 30,
      })
    : [];
  const tasks = await prisma.taskAssignment.findMany({
    where: {
      userId: user.id,
      memberId: { not: null },
      ...(member ? { task: { clubId: member.clubId } } : {}),
    },
    select: {
      id: true,
      submittedAt: true,
      reviewedAt: true,
      task: {
        select: { title: true, dueAt: true, club: { select: { name: true } } },
      },
    },
    take: 50,
    orderBy: { assignedAt: "desc" },
  });
  const recruitment =
    member &&
    (hasPermission(member, "applications.review") ||
      hasPermission(member, "applicants.identify"))
      ? await prisma.application.groupBy({
          by: ["status"],
          where: {
            clubId: member.clubId,
            status: { not: "DRAFTING" },
            ...(hasPermission(member, "applicants.identify")
              ? {}
              : { round: { anonymousReview: true } }),
          },
          _count: { _all: true },
        })
      : null;
  await prisma.auditLog.create({
    data: {
      actorId: session.actorId,
      action: "platform.view-as.read",
      targetId: user.id,
      clubId: session.clubId,
      details: { sessionId: session.id },
    },
  });
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <header>
        <p className="text-sm text-muted-foreground">
          Read-only support snapshot · No target authentication tokens are
          issued
        </p>
        <h1 className="mt-2 font-display text-3xl">
          {user.studentProfile
            ? `${user.studentProfile.firstName} ${user.studentProfile.lastName}`
            : user.email}
        </h1>
        <p className="mt-2">
          {member ? member.club.name : "Personal / Student"}
        </p>
      </header>
      <section className="border-t pt-5">
        <h2 className="font-semibold">Identity & academic context</h2>
        <p className="mt-3 text-sm">
          {user.email} · {user.studentProfile?.major} ·{" "}
          {user.studentProfile?.gradYear}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm">
          {user.studentProfile?.bio}
        </p>
      </section>
      <section className="border-t pt-5">
        <h2 className="font-semibold">Workspace access</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {user.memberships.map((m) => (
            <li key={m.id}>
              {m.club.name} ·{" "}
              {m.isOwner
                ? "Owner"
                : m.permissions.length
                  ? m.permissions.join(", ")
                  : "Member"}
            </li>
          ))}
        </ul>
      </section>
      {!member && (
        <section className="border-t pt-5">
          <h2 className="font-semibold">Student applications</h2>
          <ul className="divide-y">
            {user.applications.map((a) => (
              <li className="py-3 text-sm" key={a.id}>
                {a.club.name} · {a.status}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="border-t pt-5">
        <h2 className="font-semibold">
          Assigned work (up to 50 recent assignments)
        </h2>
        {!tasks.length && <p className="mt-3 text-sm">No assigned work.</p>}
        <ul className="divide-y">
          {tasks.map((t) => (
            <li className="py-3 text-sm" key={t.id}>
              {t.task.club.name} · {t.task.title} ·{" "}
              {t.reviewedAt
                ? "Reviewed"
                : t.submittedAt
                  ? "Submitted"
                  : "Assigned"}
            </li>
          ))}
        </ul>
      </section>
      {member && (
        <section className="border-t pt-5">
          <h2 className="font-semibold">Permitted club meetings (up to 30)</h2>
          <ul className="divide-y">
            {meetings.map((m) => (
              <li className="py-3 text-sm" key={m.id}>
                {m.title} · {m.date.toISOString().slice(0, 10)} · {m.audience}
              </li>
            ))}
          </ul>
        </section>
      )}
      {recruitment && (
        <section className="border-t pt-5">
          <h2 className="font-semibold">Permitted recruitment summary</h2>
          <p className="mt-3 text-sm">
            {recruitment
              .map((r) => `${r.status}: ${r._count._all}`)
              .join(" · ")}
          </p>
        </section>
      )}
    </main>
  );
}
