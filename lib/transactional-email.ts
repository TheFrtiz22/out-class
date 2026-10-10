/** Dependency-free email design system. Body HTML must be built from escaped values. */
export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function emailSiteOrigin(siteUrl: string) {
  const url = new URL(siteUrl);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Configure a secure OutClass site URL.');
  return url.origin;
}

// Existing public, immutable artwork. A mail proxy cannot solve the app's Vercel
// bot challenge. Keep email artwork on this public asset URL until a dedicated
// brand CDN is approved; this does not publish or upload any files.
export const emailArtworkRoot = 'https://raw.githubusercontent.com/TheFrtiz22/out-class/93502dde5e5d9155d5d8d6751cefddbb385c5da9/public';
const bundledArtwork = new Set(['/outclass-logo-light.jpeg', '/logos/180-degrees-globe.png', '/logos/180-degrees.png', '/logos/enactus-wordmark.png', '/logos/enactus.png', '/logos/mii.webp', '/logos/vvf.webp']);
export function emailArtworkUrl(url: URL, siteOrigin: string) {
  return url.origin === siteOrigin && !url.search && !url.hash && bundledArtwork.has(url.pathname) ? emailArtworkRoot + url.pathname : url.href;
}

export const emailFonts = "'Segoe UI',Helvetica,Arial,sans-serif";
export function emailParagraph(text: string, small = false) {
  return `<p class="${small ? 'muted' : 'copy'}" style="margin:0 0 18px;color:${small ? '#596575' : '#33445a'};font-size:${small ? 13 : 16}px;line-height:${small ? 21 : 26}px">${escapeEmailHtml(text)}</p>`;
}

/** Both copies carry the same URL. VML is shown only by classic Outlook's Word engine. */
export function emailButton(label: string, href: string) {
  const url = escapeEmailHtml(href), text = escapeEmailHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:50px;v-text-anchor:middle;width:232px" arcsize="8%" strokecolor="#e85b19" strokeweight="1pt" fillcolor="#142d4e"><w:anchorlock/><v:fill type="solid" color="#142d4e"/><center style="color:#fff7ec;font-family:Arial,sans-serif;font-size:15px;font-weight:bold"><span style="mso-style-textfill-type:gradient;mso-style-textfill-fill-gradientfill-stoplist:'0 #FFF7EC 0 100000,100000 #FFF7EC 0 100000'">${text}</span></center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a class="cta" href="${url}" style="display:inline-block;box-sizing:border-box;width:232px;max-width:100%;padding:14px 12px;border:1px solid #e85b19;border-radius:4px;background-color:#142d4e;color:#fff7ec;font-family:${emailFonts};font-size:15px;font-weight:600;line-height:20px;text-align:center;text-decoration:none">${text}</a><!--<![endif]-->
</td></tr></table>`;
}

export function emailFallback(href: string) {
  const url = escapeEmailHtml(href);
  return `<p class="muted" style="margin:0 0 8px;color:#596575;font-size:12px;line-height:20px">Button not opening? Copy this link into your browser.</p><p style="margin:0 0 22px;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere"><a class="text-link" href="${url}" style="color:#142d4e;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere">${url}</a></p>`;
}

export function emailCode(code: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td class="code-panel" bgcolor="#f5f5f5" style="padding:22px 24px;border-top:1px solid #c7ced5;border-bottom:1px solid #c7ced5;background-color:#f5f5f5">
<p class="muted" style="margin:0 0 10px;color:#596575;font-size:10px;line-height:16px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase">One-time verification code</p>
<p class="otp ink" style="margin:0;color:#142d4e;font-family:Consolas,'Courier New',monospace;font-size:44px;line-height:56px;font-weight:bold;letter-spacing:8px">${escapeEmailHtml(code)}</p>
</td></tr></table>`;
}

export function emailNotice(label: string, text: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td class="notice" bgcolor="#f5f5f5" style="padding:18px 20px;border-left:3px solid #e85b19;background-color:#f5f5f5"><p class="ink" style="margin:0 0 6px;color:#142d4e;font-size:14px;line-height:22px;font-weight:600">${escapeEmailHtml(label)}</p><p class="copy" style="margin:0;color:#33445a;font-size:14px;line-height:22px">${escapeEmailHtml(text)}</p></td></tr></table>`;
}

// Double rule echoes the paired sabre strokes under the official wordmark.
function signatureRule() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" aria-hidden="true"><tr><td class="brand-rule" height="2" bgcolor="#142d4e" style="height:2px;font-size:0;line-height:2px;background-color:#142d4e">&nbsp;</td><td width="32" height="2" bgcolor="#e85b19" style="width:32px;height:2px;font-size:0;line-height:2px;background-color:#e85b19">&nbsp;</td></tr><tr><td colspan="2" height="3" style="height:3px;font-size:0;line-height:3px">&nbsp;</td></tr><tr><td class="brand-rule" colspan="2" height="1" bgcolor="#142d4e" style="height:1px;font-size:0;line-height:1px;background-color:#142d4e">&nbsp;</td></tr></table>`;
}

const darkRules = [
  ['.email-bg', 'background-color:#101c2c!important'],
  ['.email-paper', 'background-color:#17263a!important'],
  ['.ink', 'color:#f5f0e7!important'],
  ['.copy', 'color:#d4dce7!important'],
  ['.muted', 'color:#b6c1cf!important'],
  ['.eyebrow', 'color:#ffab7c!important'],
  ['.text-link', 'color:#d3e2f5!important'],
  ['.code-panel', 'background-color:#213248!important;border-color:#536275!important'],
  ['.notice', 'background-color:#213248!important'],
  ['.divider', 'border-color:#536275!important'],
  ['.brand-rule', 'background-color:#93a9c3!important'],
  ['.cta', 'background-color:#f5f0e7!important;color:#142d4e!important;border-color:#ffab7c!important'],
];

export function transactionalEmailHtml(input: { title: string; preview: string; body: string; siteUrl: string; footer: string; category?: string; variant?: 'code' | 'welcome' | 'security' | 'invitation'; headingHtml?: string }) {
  const origin = emailSiteOrigin(input.siteUrl), esc = escapeEmailHtml;
  const variant = input.variant || 'security';
  const headingFont = ['welcome', 'invitation'].includes(variant) ? "Georgia,'Times New Roman',serif" : emailFonts;
  const headingSize = ['welcome', 'invitation'].includes(variant) ? 36 : 30;
  const dark = darkRules.map(([selector, rules]) => `${selector}{${rules}}`).join('');
  const outlookDark = darkRules.map(([selector, rules]) => `[data-ogsc] ${selector},[data-ogsb] ${selector}{${rules}}`).join('');
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(input.title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><style>body,table,td,p,a{font-family:Arial,sans-serif!important}table{border-collapse:collapse}h1{font-family:${headingFont}!important}</style><![endif]-->
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}body{margin:0!important;padding:0!important}img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}a:focus-visible{outline:3px solid #e85b19;outline-offset:3px}a[x-apple-data-detectors]{color:inherit!important;text-decoration:inherit!important}
@media only screen and (max-width:600px){.outer{padding:16px 12px!important}.inset{padding-left:24px!important;padding-right:24px!important}.masthead{padding-top:26px!important}.main{padding-top:26px!important}.heading{font-size:${variant === 'code' ? 27 : 30}px!important;line-height:${variant === 'code' ? 34 : 37}px!important}.otp{font-size:36px!important;line-height:46px!important;letter-spacing:5px!important}.code-panel{padding:18px 16px!important}.campus-label{display:none!important}.footer{padding-bottom:26px!important}}
@media(prefers-color-scheme:dark){${dark}}
${outlookDark}
</style></head>
<body class="email-bg" style="margin:0;padding:0;background-color:#f0f0f0;color:#142d4e;font-family:${emailFonts};font-size:16px;line-height:26px">
<div aria-hidden="true" style="display:none;font-size:1px;line-height:1px;color:#f0f0f0;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(input.preview)}${'&zwnj;&nbsp;'.repeat(24)}</div>
<table role="presentation" class="email-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f0f0" style="width:100%;background-color:#f0f0f0"><tr><td class="outer" align="center" style="padding:32px 16px">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="email-paper" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background-color:#ffffff">
<tr><td class="inset masthead" style="padding:32px 40px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="left" valign="middle"><a href="${esc(origin)}/" style="display:inline-block"><img src="${emailArtworkRoot}/outclass-logo-light.jpeg" width="174" height="48" alt="OutClass" style="display:block;width:174px;height:48px;background-color:#ffffff;color:#142d4e;font-family:Arial,sans-serif;font-size:22px;font-weight:bold"></a></td><td class="campus-label muted" align="right" valign="middle" style="color:#596575;font-size:9px;line-height:15px;letter-spacing:1.5px;text-transform:uppercase">Beginning at<br>Virginia</td></tr></table></td></tr>
<tr><td class="inset" style="padding:18px 40px 0">${signatureRule()}</td></tr>
<tr><td class="inset main" style="padding:30px 40px 8px;overflow-wrap:anywhere;word-break:normal">
<p class="eyebrow" style="margin:0 0 14px;color:#a83d0c;font-size:10px;line-height:16px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase">${esc(input.category || 'Account security')}</p>
<h1 class="heading ink" style="margin:0 0 18px;color:#142d4e;font-family:${headingFont};font-size:${headingSize}px;line-height:${headingSize + 7}px;letter-spacing:-0.6px;font-weight:${['welcome', 'invitation'].includes(variant) ? 400 : 600};overflow-wrap:anywhere">${input.headingHtml || esc(input.title)}</h1>
${input.body}</td></tr>
<tr><td class="inset footer" style="padding:12px 40px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="divider" style="padding-top:20px;border-top:1px solid #c7ced5"><p class="muted" style="margin:0 0 18px;color:#596575;font-size:12px;line-height:20px">${esc(input.footer)}</p><p class="ink" style="margin:0;color:#142d4e;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px">One profile. Every opportunity.</p><p class="muted" style="margin:6px 0 0;color:#596575;font-size:11px;line-height:18px"><a class="text-link" href="${esc(origin)}/" style="color:#142d4e;text-decoration:underline">OutClass</a> &nbsp; / &nbsp; University of Virginia</p></td></tr></table></td></tr>
</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
