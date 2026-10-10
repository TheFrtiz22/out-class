/** Shared, dependency-free email chrome. Body HTML must be built from escaped values. */
export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function emailSiteOrigin(siteUrl: string) {
  const url = new URL(siteUrl);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Configure a secure OutClass site URL.');
  return url.origin;
}

export function emailButton(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td bgcolor="#142d4e" style="border-radius:8px;mso-padding-alt:14px 22px"><a href="${escapeEmailHtml(href)}" style="display:inline-block;padding:14px 22px;border:1px solid #142d4e;border-radius:8px;background:#142d4e;color:#ffffff!important;font-size:16px;font-weight:bold;line-height:22px;text-decoration:none;mso-padding-alt:0">${escapeEmailHtml(label)}</a></td></tr></table>`;
}

export function transactionalEmailHtml(input: { title: string; preview: string; body: string; siteUrl: string; footer: string }) {
  const origin = emailSiteOrigin(input.siteUrl), esc = escapeEmailHtml;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(input.title)}</title><style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}p{margin:0 0 18px}a{color:#142d4e}img{border:0;outline:none;text-decoration:none}h1{margin:24px 0 18px;font-size:26px;line-height:1.3;overflow-wrap:anywhere}
@media only screen and (max-width:600px){.outer{padding:24px 12px!important}.inset{padding:24px!important}h1{font-size:24px!important}.otp{font-size:32px!important;letter-spacing:6px!important}}
@media(prefers-color-scheme:dark){.email-bg{background:#0e1b2d!important}.email-card{background:#17263c!important;color:#f4f6f8!important}.muted{color:#c3cbd6!important}.email-card a:not(.brand-link){color:#bed3f0}.email-footer{border-color:#3b4c63!important}}
</style></head><body class="email-bg" style="margin:0;padding:0;background:#f8f7f4;color:#14243a;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65"><div style="display:none;font-size:1px;line-height:1px;color:#f8f7f4;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(input.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="outer" align="center" style="padding:32px 16px">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:560px;background:#ffffff;border-radius:12px"><tr><td class="inset" style="padding:32px;color:inherit;word-break:normal;overflow-wrap:anywhere">
<a class="brand-link" href="${esc(origin)}/" style="display:inline-block;background:#ffffff;padding:8px 10px;border-radius:6px"><img src="${esc(origin)}/outclass-wordmark-light.png" width="170" height="50" alt="OutClass" style="display:block;width:170px;height:50px;color:#142d4e;font-size:24px;font-weight:bold"></a>
<h1>${esc(input.title)}</h1>${input.body}
<div class="email-footer muted" style="margin-top:28px;padding-top:20px;border-top:1px solid #dce0e3;color:#586473;font-size:13px;line-height:1.65"><p>${esc(input.footer)}</p><p style="margin:0"><a href="${esc(origin)}/" style="color:inherit">OutClass</a><br>One profile. Every opportunity.<br>Beginning at the University of Virginia.</p></div>
</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
