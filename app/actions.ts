'use server';

// DEMO: nessun salvataggio. Il database arriva dopo; qui si valida soltanto e si mostra l'invito.
export type DemoState = {
  errors: Record<string, string>;
  values?: Record<string, string>;
  done?: { firstName: string };
};

const VALUE_KEYS = ['first_name', 'last_name', 'consent_privacy', 'consent_coupon', 'consent_marketing'];

export async function submitDemo(_prev: DemoState, formData: FormData): Promise<DemoState> {
  const values = Object.fromEntries(VALUE_KEYS.map((k) => [k, String(formData.get(k) ?? '')]));
  const firstName = values.first_name.trim();
  const lastName = values.last_name.trim();
  const errors: Record<string, string> = {};
  if (!firstName) errors.first_name = 'Inserisci il nome';
  else if (firstName.length > 60) errors.first_name = 'Nome troppo lungo';
  if (!lastName) errors.last_name = 'Inserisci il cognome';
  else if (lastName.length > 60) errors.last_name = 'Cognome troppo lungo';
  if (values.consent_privacy !== 'on') errors.consent_privacy = "Devi accettare l'informativa privacy";
  if (values.consent_coupon !== 'on') errors.consent_coupon = 'Devi richiedere il tuo invito alla serata';
  if (Object.keys(errors).length > 0) return { errors, values };
  return { errors: {}, done: { firstName } };
}
