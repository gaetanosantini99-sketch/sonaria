import { z } from 'zod';
import { romeLocalToUtcIso, utcToRomeLocalInput } from '@/lib/dates';

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Data e ora obbligatorie');

const schema = z.object({
  title: z.string().trim().min(1, 'Titolo obbligatorio').max(120, 'Massimo 120 caratteri'),
  venue_name: z.string().trim().min(1, 'Locale obbligatorio').max(120, 'Massimo 120 caratteri'),
  starts_at: localDateTime,
  ends_at: localDateTime,
  coupon_title: z.string().trim().min(1, 'Titolo coupon obbligatorio').max(120, 'Massimo 120 caratteri'),
  coupon_description: z.string().trim().max(1000, 'Massimo 1000 caratteri'),
  pin: z.string().trim(),
});

const FIELDS = ['title', 'venue_name', 'starts_at', 'ends_at', 'coupon_title', 'coupon_description', 'pin'] as const;

export type EventInput = {
  title: string;
  venue_name: string;
  starts_at: string;
  ends_at: string;
  coupon_title: string;
  coupon_description: string;
  pin: string | null;
};

export type EventFormResult = { ok: true; data: EventInput } | { ok: false; errors: Record<string, string> };

function safeUtcIso(local: string): string | null {
  try {
    const iso = romeLocalToUtcIso(local);
    // scarta date impossibili che verrebbero "aggiustate" (es. 31 febbraio)
    return utcToRomeLocalInput(iso) === local ? iso : null;
  } catch {
    return null;
  }
}

export function parseEventForm(formData: FormData, { pinRequired }: { pinRequired: boolean }): EventFormResult {
  const raw = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? '')]));
  const parsed = schema.safeParse(raw);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  if (d.pin === '' && pinRequired) errors.pin = 'PIN obbligatorio';
  if (d.pin !== '' && !/^\d{4,8}$/.test(d.pin)) errors.pin = 'Il PIN deve avere da 4 a 8 cifre';
  const startsAt = safeUtcIso(d.starts_at);
  const endsAt = safeUtcIso(d.ends_at);
  if (!startsAt) errors.starts_at = 'Data e ora non valide';
  if (!endsAt) errors.ends_at = 'Data e ora non valide';
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) errors.ends_at = "La fine deve essere dopo l'inizio";
  if (Object.keys(errors).length > 0 || !startsAt || !endsAt) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title: d.title,
      venue_name: d.venue_name,
      starts_at: startsAt,
      ends_at: endsAt,
      coupon_title: d.coupon_title,
      coupon_description: d.coupon_description,
      pin: d.pin === '' ? null : d.pin,
    },
  };
}
