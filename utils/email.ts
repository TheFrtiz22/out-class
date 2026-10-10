import nodemailer from 'nodemailer';
import { z } from 'zod';
import { invitationEmail } from '@/lib/invitation-email';
import { studentClaimEmail } from '@/lib/student-claim-email';

/** Resend's SMTP 250 response carries its dashboard ID; Message-ID is a separate header. */
function providerReceipt(info: { messageId: string; response?: string }, host: string) {
  const providerId = host.toLowerCase() === 'smtp.resend.com'
    ? info.response?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
    : undefined;
  return { messageId: providerId || info.messageId };
}

/** Use the same SMTP provider/account as Supabase Auth; credentials stay server-side. */
export function invitationEmailConfig() {
  const config = z.object({ host: z.string().min(1), port: z.coerce.number().int().min(1).max(65535), user: z.string().min(1), password: z.string().min(1), from: z.string().email(), siteUrl: z.string().url() }).safeParse({
    host: process.env.SMTP_HOST, port: process.env.SMTP_PORT || '587', user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD, from: process.env.SMTP_FROM_EMAIL, siteUrl: process.env.OUTCLASS_SITE_URL,
  });
  if (!config.success) throw new Error('Invitation email is not configured. Configure the existing SMTP provider before sending.');
  invitationEmail({ organizationName: 'OutClass', owner: false, siteUrl: config.data.siteUrl });
  return config.data;
}

export async function sendInvitationEmail(input: { recipient: string; organizationName: string; owner: boolean; deliveryId: string; legacyInvitationId?: string }) {
  const config = invitationEmailConfig();
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, requireTLS: config.port !== 465, auth: { user: config.user, pass: config.password }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000, disableFileAccess: true, disableUrlAccess: true });
  try {
    const message = invitationEmail({ ...input, siteUrl: config.siteUrl });
    const info = await transport.sendMail({ from: { name: 'OutClass', address: config.from }, to: { address: z.string().email().parse(input.recipient), name: '' }, ...message, messageId: `<${input.deliveryId}@${new URL(config.siteUrl).hostname}>` });
    if (!info.accepted?.length) throw Object.assign(new Error('SMTP rejected the recipient.'), { responseCode: 550 });
    return providerReceipt(info, config.host);
  } finally { transport.close(); }
}

/** Auth's invite token is delivered only to its intended email; never returned to Admin UI. */
export async function sendStudentClaimEmail(input: { recipient: string; name: string; tokenHash: string; deliveryId: string; siteUrl: string }) {
  const config = invitationEmailConfig();
  const message = studentClaimEmail(input);
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, requireTLS: config.port !== 465, auth: { user: config.user, pass: config.password }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000, disableFileAccess: true, disableUrlAccess: true });
  try {
    const info = await transport.sendMail({ from: { name: 'OutClass', address: config.from }, to: z.string().email().parse(input.recipient), ...message, messageId: `<${input.deliveryId}@${new URL(config.siteUrl).hostname}>` });
    if (!info.accepted?.length) throw Error('The invitation email was not accepted. The account exists; resend from Users.');
    return providerReceipt(info, config.host);
  } finally { transport.close(); }
}
