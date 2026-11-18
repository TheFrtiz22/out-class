import { mobileOperations } from "@/lib/mobile-api/operations";
import { handleMobileRequest, type MobileOperation } from "@/utils/mobile-api";

// The native app's API. See docs/mobile/architecture.md and lib/mobile-api/operations.ts.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = { params: Promise<{ operation: string }> };
const operations = mobileOperations as unknown as Record<string, MobileOperation>;

export async function GET(request: Request, { params }: Context) {
  return handleMobileRequest(request, (await params).operation, operations);
}
export async function POST(request: Request, { params }: Context) {
  return handleMobileRequest(request, (await params).operation, operations);
}
