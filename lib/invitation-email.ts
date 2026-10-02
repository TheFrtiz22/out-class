const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function invitationEmail(input: { organizationName: string; owner: boolean; siteUrl: string; legacyInvitationId?: string }) {
  const url = new URL(input.siteUrl);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Configure a secure OutClass site URL.');
  if (input.legacyInvitationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.legacyInvitationId)) throw new Error('Invalid legacy invitation link.');
  const href = new URL(input.legacyInvitationId ? `/invitations/${input.legacyInvitationId}` : '/?next=%2Fsettings%2Forganizations', url.origin).href;
  const name = input.organizationName.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 200);
  const intro = input.owner ? `You’ve been designated as an administrator of ${name}.` : `${name} has invited you to join its community on OutClass.`;
  const identity = 'OutClass uses your verified university identity to securely match this invitation. Sign in or create an account with your university email, then review the invitation in Settings → Organizations. Joining is your choice.';
  return {
    subject: `You’re invited to ${name} on OutClass`,
    text: `${intro}\n\n${identity}\n\nSign in to OutClass: ${href}\n\nIf you weren’t expecting this invitation, you can ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#142d4e"><main style="max-width:560px;margin:32px auto;padding:32px;background:white;border-radius:12px"><p style="font-size:24px;font-weight:bold">OutClass</p><h1 style="font-size:22px">${escapeHtml(intro)}</h1><p style="line-height:1.7">${escapeHtml(identity)}</p><p style="margin:28px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#142d4e;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">Sign in to OutClass</a></p><p style="font-size:12px;line-height:1.6">If you weren’t expecting this invitation, you can ignore this email.</p></main></body></html>`,
  };
}
