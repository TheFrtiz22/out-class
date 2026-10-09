import { AdminAccessError } from "@/lib/admin-failure";
import { logAdminFailure } from "@/utils/admin-page";
import { NextResponse } from "next/server";
import { requirePlatformAdminEligibility } from "@/utils/platform-admin";
export async function GET() {
  let eligible = false;
  try { await requirePlatformAdminEligibility(); eligible = true; }
  catch (error) {
    if (!(error instanceof AdminAccessError)) {
      const supportCode = logAdminFailure("/api/platform/eligibility", error);
      return NextResponse.json({ eligible: false, error: "Admin temporarily unavailable", supportCode }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
    }
  }
  return NextResponse.json({ eligible }, { headers: { "Cache-Control": "private, no-store" } });
}
