'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useActionState, useEffect } from 'react';
import { FieldError } from '@/components/field-error';
import { register, type RegisterState } from './actions';

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string) => void };
  }
}

export function RegisterForm({ slug, siteKey }: { slug: string; siteKey: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register.bind(null, slug), { errors: {} });
  const v = state.values ?? {};

  useEffect(() => {
    if (Object.keys(state.errors).length > 0) window.turnstile?.reset();
  }, [state]);

  return (
    <form action={action} className="card space-y-4" noValidate>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
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
      <div>
        <label className="label" htmlFor="phone">Telefono (facoltativo)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" defaultValue={v.phone} />
        <FieldError message={state.errors.phone} />
      </div>

      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_privacy" defaultChecked={v.consent_privacy === 'on'} className="mt-0.5 size-5 accent-accent" />
          <span>
            Ho letto l&apos;<Link href="/privacy" target="_blank" className="underline">informativa privacy</Link> e acconsento al trattamento dei miei dati
          </span>
        </label>
        <FieldError message={state.errors.consent_privacy} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_coupon" defaultChecked={v.consent_coupon === 'on'} className="mt-0.5 size-5 accent-accent" />
          <span>Accetto il coupon della serata e le sue condizioni</span>
        </label>
        <FieldError message={state.errors.consent_coupon} />
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent_marketing" defaultChecked={v.consent_marketing === 'on'} className="mt-0.5 size-5 accent-accent" />
          <span>Acconsento a ricevere offerte dedicate nei prossimi 30 giorni (facoltativo)</span>
        </label>
      </div>

      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" data-language="it" />
      <FieldError message={state.errors.form} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? 'Attendi…' : 'Ottieni il coupon'}</button>
    </form>
  );
}
