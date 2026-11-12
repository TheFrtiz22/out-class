import { emailButton, emailFallback, emailParagraph, emailSiteOrigin, transactionalEmailHtml } from '@/lib/transactional-email';

/** Sent when two-step sign-in is turned on or off. Carries no code, secret or bearer link. */
export function twoStepNoticeEmail(input: { enabled: boolean; siteUrl: string }) {
  const origin = emailSiteOrigin(input.siteUrl);
  const link = new URL('/settings/account', origin).href;
  const intro = input.enabled
    ? 'Two-step sign-in is now on for your OutClass account. Signing in will ask for a code from your authenticator app.'
    : 'Two-step sign-in is now off for your OutClass account. Signing in no longer asks for an authenticator code.';
  const footer = 'If you didn’t make this change, reset your password and contact OutClass support from your university email.';
  return {
    subject: input.enabled ? 'Two-step sign-in is on' : 'Two-step sign-in is off',
    text: `${intro}\n\nReview your account security:\n${link}\n\n${footer}`,
    html: transactionalEmailHtml({ title: input.enabled ? 'Two-step sign-in is on' : 'Two-step sign-in is off', category: 'Your account / Security', variant: 'security', preview: intro, siteUrl: origin,
      body: emailParagraph(intro) + emailButton('Review account security', link) + emailFallback(link),
      footer,
    }),
  };
}
