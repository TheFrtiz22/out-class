import { prisma } from "@/utils/prisma";
import { signInReturnPath } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Email entry points must preserve the existing first-login profile requirement. */
export async function requireCompletedStudentProfile(userId: string, returnPath: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) redirect(`/?next=${encodeURIComponent(signInReturnPath(returnPath))}`);
}
