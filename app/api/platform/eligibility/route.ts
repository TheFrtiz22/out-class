import { NextResponse } from "next/server";
import { requirePlatformAdminEligibility } from "@/utils/platform-admin";
export async function GET() {
  const eligible = await requirePlatformAdminEligibility().then(() => true).catch(() => false);
  return NextResponse.json({ eligible }, { headers: { "Cache-Control": "private, no-store" } });
}
