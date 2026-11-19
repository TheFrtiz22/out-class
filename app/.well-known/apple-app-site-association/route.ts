import { appleAppSiteAssociation, appLinkResponse } from "@/lib/app-links";

// Public, unsigned JSON that Apple fetches to associate /q links with the native app (lib/app-links.ts).
export const dynamic = "force-dynamic";
export function GET() {
  return appLinkResponse(appleAppSiteAssociation());
}
