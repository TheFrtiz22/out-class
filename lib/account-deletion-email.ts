import { emailButton, emailFallback, emailNotice, emailParagraph, emailSiteOrigin, transactionalEmailHtml } from '@/lib/transactional-email';

/** Confirmation of a deletion request. Cancelling needs a signed-in session (no bearer link). */
export function accountDeletionEmail(input: { scheduledFor: Date; siteUrl: string }) {
  const origin = emailSiteOrigin(input.siteUrl);
  const link = new URL('/settings/account', origin).href;
  const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'America/New_York' }).format(input.scheduledFor);
  const intro = `We received a request to delete your OutClass account. It is scheduled for deletion on ${date}.`;
  const what = 'Your profile, résumé, headshot, files and in-progress applications will be deleted. For decided applications, the club keeps its own review notes and the decision, linked to an anonymized placeholder, and your answers are removed. Decision letters and interview copies of your résumé that a club already holds stay with that club’s records.';
  const cancel = 'Changed your mind? Sign in and cancel from Settings → Account before that date.';
  const footer = 'If you didn’t request this, sign in and cancel the request, then change your password.';
  return {
    subject: 'Your OutClass account deletion request',
    text: `${intro}\n\n${what}\n\n${cancel}\n${link}\n\n${footer}`,
    html: transactionalEmailHtml({ title: 'Account deletion requested', category: 'Your account / Security', variant: 'security', preview: `Scheduled for ${date}. You can cancel until then.`, siteUrl: origin,
      body: emailParagraph(intro) + emailNotice('What happens', what) + emailParagraph(cancel) + emailButton('Review or cancel', link) + emailFallback(link),
      footer,
    }),
  };
}
