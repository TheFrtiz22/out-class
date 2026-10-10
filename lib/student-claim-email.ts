import { emailButton, emailFallback, emailNotice, emailParagraph, emailSiteOrigin, transactionalEmailHtml } from '@/lib/transactional-email';

export function studentClaimEmail(input: { name: string; tokenHash: string; siteUrl: string }) {
  const origin = emailSiteOrigin(input.siteUrl);
  if (!/^[A-Za-z0-9_-]{16,512}$/.test(input.tokenHash)) throw new Error('Invalid student invitation token.');
  const link = new URL('/auth/student-claim', origin);
  link.hash = new URLSearchParams({ token_hash: input.tokenHash }).toString();
  const name = input.name.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 100);
  const explanation = 'Your OutClass account is ready. Choose your own password using this single-use invitation.';
  const expiry = 'This link expires according to the university authentication service’s invitation policy. If it has expired, request another invitation.';
  return {
    subject: 'Claim your OutClass student account',
    text: `Hello ${name},\n\n${explanation}\n${link}\n\n${expiry}\n\nIf you weren’t expecting this invitation, ignore this email or contact the administrator who invited you.`,
    html: transactionalEmailHtml({ title: 'Your campus. Your possibilities.', category: 'Your student account / Invitation', variant: 'welcome', preview: 'Your OutClass account is ready. Make it yours.', siteUrl: origin,
      body: emailParagraph(`Hello ${name},`) + emailParagraph(explanation) + emailButton('Claim your account', link.href) + emailNotice('Make it yours', 'One profile connects you to organizations and opportunities across your university.') + emailParagraph(expiry, true) + emailFallback(link.href),
      footer: 'If you weren’t expecting this invitation, ignore this email or contact the administrator who invited you.',
    }),
  };
}
