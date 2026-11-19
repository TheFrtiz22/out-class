import { androidAssetLinks, appLinkResponse } from "@/lib/app-links";

// Public JSON that Android fetches to verify /q links for the native app (lib/app-links.ts).
export const dynamic = "force-dynamic";
export function GET() {
  return appLinkResponse(androidAssetLinks());
}
