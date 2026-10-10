import { emailButton, emailCode, emailFallback, emailNotice, emailParagraph, transactionalEmailHtml } from '@/lib/transactional-email';

export const authEmailSubjects = {
  confirmation: 'Verify your UVA email — OutClass',
  'magic-link': 'Your OutClass sign-in code',
  recovery: 'Reset your password',
  'password-changed': 'Your password was changed',
  invite: 'Your OutClass invitation',
  'email-change': 'Confirm your new email address',
  reauthentication: 'Your OutClass verification code',
};

/** Versioned Go-template variables preserve the existing Auth flows. No provider mutations. */
export function authEmailTemplates(siteUrl: string) {
  const expiration = 'Expires in one hour. Use it once, and never share it.';
  const reset = '{{ .RedirectTo }}#token_hash={{ .TokenHash }}';
  const confirmation = '{{ .ConfirmationURL }}';
  const compose = (title: string, category: string, preview: string, body: string, footer: string, variant: 'code' | 'welcome' | 'security' = 'security') => transactionalEmailHtml({ title, category, preview, body, footer, variant, siteUrl });
  return {
    'magic-link': {
      html: compose('Your sign-in code.', 'Sign in / OutClass', 'Your one-time code for OutClass. Expires in one hour.', emailParagraph('Enter this code in OutClass to pick up where you left off.') + emailCode('{{ .Token }}') + emailParagraph(expiration, true), 'Didn’t request this code? You can safely ignore this email.', 'code'),
      text: `Your OutClass sign-in code\n\nEnter this code in OutClass: {{ .Token }}\n\n${expiration}\n\nDidn’t request this code? Ignore this email.`,
    },
    confirmation: {
      html: compose('Your next opportunity starts here.', 'Your university / Your possibilities', 'Verify your university email and start exploring OutClass.', emailParagraph('Clubs to discover. People to meet. A place to begin.') + emailParagraph('Verify your university email with the code below.') + emailCode('{{ .Token }}') + emailParagraph(expiration, true), 'Didn’t create an OutClass account? You can safely ignore this email.', 'welcome'),
      text: `Your next opportunity starts here.\n\nVerify your university email with this code: {{ .Token }}\n\n${expiration}\n\nDidn’t create an account? Ignore this email.`,
    },
    recovery: {
      html: compose('Reset your password.', 'Account security / Password reset', 'Choose a new password for your OutClass account.', emailParagraph('You requested a password reset. Choose a new password to get back to OutClass.') + emailButton('Reset password', reset) + emailParagraph('This single-use link expires in one hour. If it has expired, request a new reset email.', true) + emailFallback(reset), 'Didn’t request a reset? Ignore this email. Your password will stay the same.'),
      text: `Reset your OutClass password\n\nChoose a new password: ${reset}\n\nThis single-use link expires in one hour. If it has expired, request a new reset email.\n\nDidn’t request a reset? Ignore this email. Your password will stay the same.`,
    },
    'password-changed': {
      html: compose('Your password is updated.', 'Account security / Confirmation', 'The password for your OutClass account was changed.', emailNotice('Password change confirmed', 'Your OutClass account now uses your new password.') + emailParagraph('If you made this change, you’re all set.') + emailParagraph('Wasn’t you? Request a password reset immediately. If you need help, contact your university administrator.') + emailButton('Review account security', siteUrl + '/login'), 'This is an account security notice from OutClass.'),
      text: `Your OutClass password was changed.\n\nIf you made this change, no further action is needed.\n\nWasn’t you? Request a password reset immediately at ${siteUrl}/login. If you need help, contact your university administrator.`,
    },
    invite: {
      html: compose('A place for you at OutClass.', 'Your student account / Invitation', 'You’ve been invited to create an OutClass account.', emailParagraph('An administrator has invited you to OutClass. Accept your invitation to set up your account.') + emailButton('Accept invitation', confirmation) + emailFallback(confirmation), 'Not expecting this? Ignore this email or contact the administrator who invited you.', 'welcome'),
      text: `You’ve been invited to OutClass.\n\nAccept your invitation: ${confirmation}\n\nNot expecting this? Ignore this email or contact the administrator who invited you.`,
    },
    'email-change': {
      html: compose('Confirm your new address.', 'Account security / Email address', 'Confirm the new email address for your OutClass account.', emailParagraph('You requested a new email address for your OutClass account.') + emailNotice('New email address', '{{ .NewEmail }}') + emailButton('Confirm email address', confirmation) + emailFallback(confirmation), 'Didn’t request this change? Don’t confirm it. Sign in and review your account security.'),
      text: `Confirm your new OutClass email address: {{ .NewEmail }}\n\n${confirmation}\n\nDidn’t request this change? Don’t confirm it. Review your account security.`,
    },
    reauthentication: {
      html: compose('One more security check.', 'Account security / Verify identity', 'Verify your identity to continue in OutClass.', emailParagraph('Enter this code in OutClass to confirm it’s you and continue.') + emailCode('{{ .Token }}') + emailParagraph('Use it once, and never share it. If it has expired, request a new code.', true), 'Didn’t request this code? Ignore this email and review your account security.', 'code'),
      text: `Verify your identity in OutClass: {{ .Token }}\n\nUse it once, and never share it. If it has expired, request a new code.\n\nDidn’t request this code? Ignore this email and review your account security.`,
    },
  };
}
