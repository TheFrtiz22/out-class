import { z } from "zod";
import { emailButton, emailParagraph, emailSiteOrigin, transactionalEmailHtml } from "@/lib/transactional-email";

export const notificationEmailPayload = z.object({
  from: z.string().email(), to: z.string().email(), subject: z.string().min(1).max(200),
  text: z.string(), html: z.string(), categories: z.array(z.string()).min(1), digest: z.boolean(),
});
export type NotificationEmailPayload = z.infer<typeof notificationEmailPayload>;
export function communicationEmailConfig() {
  if (process.env.COMMUNICATIONS_EMAIL_ENABLED !== "true") return null;
  const parsed = z.object({ key: z.string().min(1), from: z.string().email(), siteUrl: z.string().url() }).safeParse({ key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL, siteUrl: process.env.OUTCLASS_SITE_URL });
  if (!parsed.success) throw new Error("Communication email delivery is not configured.");
  return { ...parsed.data, siteUrl: emailSiteOrigin(parsed.data.siteUrl) };
}
export function buildNotificationEmail(input: { from: string; to: string; siteUrl: string; digest: boolean; items: { type: string; title: string; club: { name: string } | null; href?: string }[] }): NotificationEmailPayload {
  const decisionHref = (path: string | undefined) => new URL(z.string().regex(/^\/applications\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\/decision\?letterId=[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i).parse(path), emailSiteOrigin(input.siteUrl)).href;
  const decision = !input.digest && input.items.length === 1 && input.items[0].type === "DECISION" ? input.items[0] : null;
  if (decision) {
    // Only server-generated canonical letter paths can become email destinations.
    const href = decisionHref(decision.href);
    const subject = `Your decision from ${(decision.club?.name || "your club").slice(0,150)} is available`;
    return {from:input.from,to:input.to,subject,digest:false,categories:["DECISION"],
      text:`${subject}.\n\nSign in to read your formal letter.\n\nView Decision: ${href}`,
      html:transactionalEmailHtml({title:"Your decision is available",preview:subject,siteUrl:input.siteUrl,category:"Recruitment",variant:"invitation",body:emailParagraph(subject+".")+emailParagraph("Sign in to OutClass to read your formal letter and review any next steps.")+emailButton("View Decision",href),footer:"Your decision is available only after signing in. Application-email preferences apply; your in-app letter remains available."})};
  }
  const href = new URL("/?workspace=student&view=inbox", emailSiteOrigin(input.siteUrl)).href;
  const preferences = new URL("/?workspace=student&view=inbox&tab=preferences", input.siteUrl).href;
  const subject = input.digest ? "Your daily OutClass updates" : "You have an OutClass update";
  // Private message bodies, interview details and application decisions stay in-app.
  const summary = input.items.map(item => item.type === "DECISION" ? `Your decision from ${item.club?.name || "your club"} is available.\nView Decision: ${decisionHref(item.href)}` : `${item.club?.name || "OutClass"}: ${item.type === "MESSAGE" ? "New private message" : item.title}`).join("\n");
  return { from: input.from, to: input.to, subject, digest: input.digest, categories: [...new Set(input.items.map(item => item.type))],
    text: `${subject}\n\n${summary}\n\nRead and reply: ${href}\nEmail preferences: ${preferences}`,
    html: transactionalEmailHtml({ title: subject, preview: "Your campus, connected.", siteUrl: input.siteUrl, category: "Your OutClass updates", variant: "welcome", body: input.items.map(item => item.type === "DECISION" ? emailParagraph(`Your decision from ${item.club?.name || "your club"} is available.`) + emailButton("View Decision", decisionHref(item.href)) : emailParagraph(`${item.club?.name || "OutClass"}: ${item.type === "MESSAGE" ? "New private message" : item.title}`)).join("") + emailButton("Open your inbox", href) + emailButton("Email preferences", preferences), footer: "You receive optional updates according to your OutClass email preferences. Change these preferences in your inbox." }),
  };
}
export class NotificationDeliveryError extends Error {
  constructor(public code: string, public retryable: boolean, public retryAfterMs = 0) { super(code); }
}
export async function sendNotificationEmail(payload: NotificationEmailPayload, deliveryId: string, key: string) {
  const { categories: _categories, digest: _digest, ...message } = notificationEmailPayload.parse(payload);
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `outclass-notification/${deliveryId}` }, body: JSON.stringify(message), signal: AbortSignal.timeout(10000) });
  } catch { throw new NotificationDeliveryError("PROVIDER_UNAVAILABLE", true); }
  if (!response.ok) {
    const retry = [408, 409, 425, 429].includes(response.status) || response.status >= 500;
    const delay = Number(response.headers.get("retry-after"));
    throw new NotificationDeliveryError(`RESEND_${response.status}`, retry, Number.isFinite(delay) ? Math.max(0, Math.min(delay * 1000, 3600000)) : 0);
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data.id !== "string") throw new NotificationDeliveryError("PROVIDER_RECEIPT_UNAVAILABLE", true);
  return { id: data.id };
}
