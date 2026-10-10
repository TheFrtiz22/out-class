import { emailButton, emailSiteOrigin, escapeEmailHtml, transactionalEmailHtml } from '@/lib/transactional-email';

export function invitationEmail(input: { organizationName: string; owner: boolean; siteUrl: string; legacyInvitationId?: string }) {
  const origin = emailSiteOrigin(input.siteUrl);
  if (input.legacyInvitationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.legacyInvitationId)) throw new Error('Invalid legacy invitation link.');
  const href = new URL(input.legacyInvitationId ? `/invitations/${input.legacyInvitationId}` : '/?next=%2Fsettings%2Forganizations', origin).href;
  const name = input.organizationName.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 200);
  const intro = input.owner ? `You’ve been designated as an administrator of ${name}.` : `${name} has invited you to join its community on OutClass.`;
  const identity = 'OutClass uses your verified university identity to securely match this invitation. Sign in or create an account with your university email, then review the invitation in Settings → Organizations. Joining is your choice.';
  return {
    subject: `You’re invited to ${name} on OutClass`,
    text: `${intro}\n\n${identity}\n\nSign in to OutClass: ${href}\n\nIf you weren’t expecting this invitation, you can ignore this email.`,
    html: transactionalEmailHtml({ title: intro, preview: input.owner ? `Review your administrator invitation to ${name}.` : `Review your invitation to ${name}.`, siteUrl: origin, body: `<p>${escapeEmailHtml(identity)}</p>${emailButton('Sign in to OutClass', href)}<p class="muted" style="font-size:13px;color:#586473">You can also open this link:<br><a href="${escapeEmailHtml(href)}" style="overflow-wrap:anywhere;word-break:break-all">${escapeEmailHtml(href)}</a></p>`, footer: 'If you weren’t expecting this invitation, you can ignore this email. For help, contact the organization that invited you.' }),
  };
}
