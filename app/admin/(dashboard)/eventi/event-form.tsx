'use client';

import { useActionState } from 'react';
import { FieldError } from '@/components/field-error';
import type { EventFormState } from './actions';

type Field = 'title' | 'venue_name' | 'starts_at' | 'ends_at' | 'coupon_title' | 'coupon_description';

function TextField({ name, label, type = 'text', defaultValue, error }: {
  name: string; label: string; type?: string; defaultValue: string; error?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" defaultValue={defaultValue} />
      <FieldError message={error} />
    </div>
  );
}

export function EventForm({ action, defaults = {}, pinRequired, submitLabel }: {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>;
  defaults?: Partial<Record<Field, string>>;
  pinRequired: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const value = (field: Field) => state.values?.[field] ?? defaults[field] ?? '';
  return (
    <form action={formAction} className="card max-w-xl space-y-4">
      <TextField name="title" label="Titolo serata" defaultValue={value('title')} error={state.errors.title} />
      <TextField name="venue_name" label="Locale" defaultValue={value('venue_name')} error={state.errors.venue_name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="starts_at" label="Inizio" type="datetime-local" defaultValue={value('starts_at')} error={state.errors.starts_at} />
        <TextField name="ends_at" label="Fine" type="datetime-local" defaultValue={value('ends_at')} error={state.errors.ends_at} />
      </div>
      <TextField name="coupon_title" label="Titolo coupon" defaultValue={value('coupon_title')} error={state.errors.coupon_title} />
      <div>
        <label className="label" htmlFor="coupon_description">Descrizione coupon</label>
        <textarea id="coupon_description" name="coupon_description" rows={3} className="input" defaultValue={value('coupon_description')} />
        <FieldError message={state.errors.coupon_description} />
      </div>
      <div>
        <label className="label" htmlFor="pin">{pinRequired ? 'PIN baristi' : 'Nuovo PIN baristi (vuoto = invariato)'}</label>
        <input id="pin" name="pin" inputMode="numeric" autoComplete="off" className="input" />
        <FieldError message={state.errors.pin} />
      </div>
      <FieldError message={state.errors.form} />
      {state.saved && <p className="text-ok">Salvato ✓</p>}
      <button className="btn btn-primary" disabled={pending}>{submitLabel}</button>
    </form>
  );
}
