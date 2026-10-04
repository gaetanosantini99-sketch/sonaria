import { z } from 'zod';
import { normalizePhone } from '@/lib/phone';

const names = z.object({
  first_name: z.string().trim().min(1, 'Inserisci il nome').max(60, 'Nome troppo lungo'),
  last_name: z.string().trim().min(1, 'Inserisci il cognome').max(60, 'Cognome troppo lungo'),
});

export type RegistrationInput = { firstName: string; lastName: string; phone: string | null; consentMarketing: boolean };
export type RegistrationParse = { ok: true; data: RegistrationInput } | { ok: false; errors: Record<string, string> };

export function parseRegistration(formData: FormData): RegistrationParse {
  const errors: Record<string, string> = {};
  const parsed = names.safeParse({
    first_name: String(formData.get('first_name') ?? ''),
    last_name: String(formData.get('last_name') ?? ''),
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  }
  const phone = normalizePhone(String(formData.get('phone') ?? ''));
  if (!phone.ok) errors.phone = 'Numero di telefono non valido';
  if (formData.get('consent_privacy') !== 'on') errors.consent_privacy = "Devi accettare l'informativa privacy";
  if (formData.get('consent_coupon') !== 'on') errors.consent_coupon = 'Devi accettare le condizioni del coupon';

  if (!parsed.success || !phone.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      firstName: parsed.data.first_name,
      lastName: parsed.data.last_name,
      phone: phone.value,
      consentMarketing: formData.get('consent_marketing') === 'on',
    },
  };
}
