/**
 * Applicant phone numbers: the pure rules from the web's lib/phone.ts, shared with the native app
 * so both show the same message before a save. The server (lib/phone.ts `phoneSchema`) remains
 * the authority and normalizes again on every write. Stored in E.164 ("+14345550123"); a number
 * typed without a country code is read as US/Canada.
 */
export const PHONE_REQUIRED_MESSAGE = "Add a phone number to your profile before submitting. Clubs call applicants they accept.";
export const PHONE_INVALID_MESSAGE = "Enter a 10-digit US number, or start with + and your country code.";

export function normalizePhone(value: string): string {
  const text = value.trim();
  if (!text || text.length > 40 || /[^\d\s().+-]/.test(text) || text.lastIndexOf("+") > 0) throw new Error(PHONE_INVALID_MESSAGE);
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error(PHONE_INVALID_MESSAGE);
    if (digits.startsWith("1") && !/^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)) throw new Error(PHONE_INVALID_MESSAGE);
    return `+${digits}`;
  }
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) throw new Error(PHONE_INVALID_MESSAGE);
  return `+1${national}`;
}

/** A stored value is only trusted when it is already normalized. */
export function validPhone(value?: string | null): value is string {
  return !!value && /^\+[1-9]\d{7,14}$/.test(value);
}

/** "(434) 555-0123" for US/Canada numbers; other numbers are shown as stored. */
export function formatPhone(value?: string | null): string {
  if (!validPhone(value)) return "";
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(value);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : value;
}
