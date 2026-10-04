'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { FieldError } from '@/components/field-error';
import { submitDemo, type DemoState } from './actions';

export function DemoForm() {
  const [state, action, pending] = useActionState<DemoState, FormData>(submitDemo, { errors: {} });
  const v = state.values ?? {};

  if (state.done) {
    return (
      <section className="card space-y-3 text-center" aria-live="polite">
        <p className="text-sm uppercase tracking-widest text-muted">Sei dentro</p>
        <h2 className="text-2xl font-black">Grazie {state.done.firstName}!</h2>
        <p className="rounded-xl border border-accent px-4 py-5 text-xl font-black text-accent">Buono sconto serata attivo</p>
        <p className="text-sm text-muted">Mostralo al bancone durante la serata.</p>
      </section>
    );
  }

  return (
    <form action={action} className="card space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="first_name">Nome</label>
        <input id="first_name" name="first_name" autoComplete="given-name" className="input" defaultValue={v.first_name} />
        <FieldError message={state.errors.first_name} />
      </div>
      <div>
        <label className="label" htmlFor="last_name">Cognome</label>
        <input id="last_name" name="last_name" autoComplete="family-name" className="input" defaultValue={v.last_name} />
        <FieldError message={state.errors.last_name} />
      </div>

      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_privacy" defaultChecked={v.consent_privacy === 'on'} className="mt-0.5 size-5 shrink-0 accent-accent" />
          <span>
            Ho letto l&apos;<Link href="/privacy" target="_blank" className="underline">informativa privacy</Link> e acconsento al trattamento dei miei dati
          </span>
        </label>
        <FieldError message={state.errors.consent_privacy} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_coupon" defaultChecked={v.consent_coupon === 'on'} className="mt-0.5 size-5 shrink-0 accent-accent" />
          <span>Voglio il buono sconto della serata</span>
        </label>
        <FieldError message={state.errors.consent_coupon} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_marketing" defaultChecked={v.consent_marketing === 'on'} className="mt-0.5 size-5 shrink-0 accent-accent" />
          <span>Acconsento a ricevere promozioni nei prossimi 30 giorni (facoltativo)</span>
        </label>
      </div>

      <button className="btn btn-primary w-full" disabled={pending}>{pending ? 'Attendi…' : 'Ottieni il buono'}</button>
    </form>
  );
}
