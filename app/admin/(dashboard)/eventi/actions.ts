'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { parseEventForm } from '@/lib/event-form';
import { isEventStatus } from '@/lib/event-status';
import { makeEventSlug } from '@/lib/slug';

export type EventFormState = { errors: Record<string, string>; values?: Record<string, string>; saved?: boolean };

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('$') && key !== 'pin') values[key] = value;
  }
  return values;
}

export async function createEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const supabase = await requireAdmin();
  const parsed = parseEventForm(formData, { pinRequired: true });
  if (!parsed.ok) return { errors: parsed.errors, values: formValues(formData) };
  const { pin, ...fields } = parsed.data;

  const { data: event, error } = await supabase
    .from('events')
    .insert({ ...fields, slug: makeEventSlug(fields.title) })
    .select('id')
    .single();
  if (error || !event) return { errors: { form: 'Errore nel salvataggio, riprova' }, values: formValues(formData) };

  const { error: pinError } = await supabase.rpc('admin_set_event_pin', { p_event_id: event.id, p_pin: pin! });
  if (pinError) return { errors: { pin: 'PIN non salvato: impostalo dalla pagina della serata' }, values: formValues(formData) };

  revalidatePath('/admin/eventi');
  redirect(`/admin/eventi/${event.id}`);
}

export async function updateEvent(eventId: string, _prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const supabase = await requireAdmin();
  const parsed = parseEventForm(formData, { pinRequired: false });
  if (!parsed.ok) return { errors: parsed.errors, values: formValues(formData) };
  const { pin, ...fields } = parsed.data;

  const { error } = await supabase.from('events').update(fields).eq('id', eventId);
  if (error) return { errors: { form: 'Errore nel salvataggio, riprova' }, values: formValues(formData) };
  if (pin) {
    const { error: pinError } = await supabase.rpc('admin_set_event_pin', { p_event_id: eventId, p_pin: pin });
    if (pinError) return { errors: { pin: 'PIN non salvato, riprova' }, values: formValues(formData) };
  }
  revalidatePath(`/admin/eventi/${eventId}`);
  return { errors: {}, values: formValues(formData), saved: true };
}

export async function setEventStatus(eventId: string, status: string): Promise<void> {
  const supabase = await requireAdmin();
  if (!isEventStatus(status)) throw new Error('Stato non valido');
  const { error } = await supabase.from('events').update({ status }).eq('id', eventId);
  if (error) throw new Error('Cambio stato non riuscito');
  revalidatePath(`/admin/eventi/${eventId}`);
  revalidatePath('/admin/eventi');
}
