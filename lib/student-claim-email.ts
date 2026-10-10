import { emailButton, emailSiteOrigin, escapeEmailHtml, transactionalEmailHtml } from '@/lib/transactional-email';

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
    html: transactionalEmailHtml({ title: 'Your OutClass account is ready', preview: 'Choose your own password to claim your student account.', siteUrl: origin, body: `<p>Hello ${escapeEmailHtml(name)},</p><p>${explanation}</p>${emailButton('Claim your account', link.href)}<p class="muted" style="color:#586473;font-size:13px">${expiry}</p><p class="muted" style="color:#586473;font-size:13px">You can also open this link:<br><a href="${escapeEmailHtml(link.href)}" style="overflow-wrap:anywhere;word-break:break-all">${escapeEmailHtml(link.href)}</a></p>`, footer: 'If you weren’t expecting this invitation, ignore this email or contact the administrator who invited you.' }),
  };
}
