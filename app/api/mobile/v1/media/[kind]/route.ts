import type { NextRequest } from "next/server";
import { handleMobileMedia } from "@/utils/mobile-api";

// Private media for the native app: the web's own handlers, reached with the app's bearer session
// (utils/mobile-api.ts handleMobileMedia). Each handler keeps its own authorization.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Handler = (request: NextRequest) => Promise<Response>;
const handlers: Record<string, () => Promise<Handler>> = {
  "profile-photos": async () => (await import("@/app/api/profile-photos/route")).GET,
  "resumes": async () => (await import("@/app/api/resumes/route")).GET,
  "application-attachments": async () => (await import("@/app/api/application-attachments/route")).GET,
  "club-assets": async () => (await import("@/app/api/club-assets/route")).GET,
  "decision-letter-assets": async () => (await import("@/app/api/decision-letter-assets/route")).GET,
  "interview-resumes": async () => (await import("@/app/api/interview-resumes/route")).GET,
  "recruiting-resumes": async () => (await import("@/app/api/recruiting-resumes/route")).GET,
};

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const load = Object.hasOwn(handlers, kind) ? handlers[kind] : undefined;
  return handleMobileMedia(request, load ? await load() : undefined);
}
