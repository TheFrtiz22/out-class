import { clubAssetSource } from "@/lib/club-assets";
import { emailArtworkUrl, emailButton, emailFallback, emailNotice, emailParagraph, emailSiteOrigin, escapeEmailHtml, transactionalEmailHtml } from '@/lib/transactional-email';

/** Optional organization artwork never becomes a link or a delivery attachment. */
export function invitationLogoUrl(value: string | null | undefined, origin: string) {
  if (!value) return null;
  try {
    const url = new URL(clubAssetSource(value), origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
    return emailArtworkUrl(url, origin);
  } catch { return null; }
}

export function invitationEmail(input: { organizationName: string; organizationLogoUrl?: string | null; owner: boolean; siteUrl: string; legacyInvitationId?: string }) {
  const origin = emailSiteOrigin(input.siteUrl);
  if (input.legacyInvitationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.legacyInvitationId)) throw new Error('Invalid legacy invitation link.');
  const href = new URL(input.legacyInvitationId ? `/invitations/${input.legacyInvitationId}` : '/?next=%2Fsettings%2Forganizations', origin).href;
  const name = input.organizationName.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 200);
  const intro = input.owner ? `${name} has invited you to help lead its community on OutClass.` : `${name} has invited you to join its community on OutClass.`;
  const identity = 'OutClass uses your verified university identity to securely match this invitation. Sign in or create an account with your university email, then review the invitation in Settings → Organizations. Joining is your choice.';
  const role = input.owner ? 'Administrator invitation' : 'Community invitation';
  const logo = invitationLogoUrl(input.organizationLogoUrl, origin);
  const logoHtml = logo ? `<img src="${escapeEmailHtml(logo)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:contain;background-color:#ffffff;border:1px solid #c7ced5;margin-bottom:18px">` : '';
  return {
    subject: `You’re invited to ${name} on OutClass`,
    text: `${role}\n${intro}\n\n${input.owner ? 'Review your administrator designation before taking on this role.\n\n' : ''}${identity}\n\nReview invitation: ${href}\n\nIf you weren’t expecting this invitation, you can ignore this email. For help, contact the organization that invited you.`,
    html: transactionalEmailHtml({
      title: name, headingHtml: logoHtml + escapeEmailHtml(name), category: input.owner ? 'An invitation to lead' : 'An invitation to belong', variant: 'invitation',
      preview: input.owner ? `Review your administrator invitation to ${name}.` : `A place for you in ${name}.`, siteUrl: origin,
      body: emailParagraph(input.owner ? 'Your organization. Your next chapter.' : 'Find your people. Take your place.') + emailParagraph(intro) + (input.owner ? emailNotice('Your role / Administrator', 'Review your designation before taking on this role. Access is granted only after you accept the invitation.') : '') + emailButton('Review invitation', href) + emailParagraph(identity, true) + emailFallback(href),
      footer: 'If you weren’t expecting this invitation, you can ignore this email. For help, contact the organization that invited you.',
    }),
  };
}
