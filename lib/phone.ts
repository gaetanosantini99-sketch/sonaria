import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type PhoneResult = { ok: true; value: string | null } | { ok: false };

export function normalizePhone(input: string): PhoneResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, value: null };
  const phone = parsePhoneNumberFromString(trimmed, 'IT');
  if (!phone || !phone.isValid()) return { ok: false };
  return { ok: true, value: phone.number };
}
