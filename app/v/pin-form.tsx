'use client';

import { useActionState } from 'react';
import { FieldError } from '@/components/field-error';
import { verifyPin, type PinState } from './actions';

export function PinForm({ staffToken }: { staffToken: string }) {
  const [state, action, pending] = useActionState<PinState, FormData>(verifyPin.bind(null, staffToken), {});
  return (
    <form action={action} className="card space-y-3">
      <label className="label" htmlFor="pin">PIN</label>
      <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus className="input text-center text-2xl tracking-widest" />
      <FieldError message={state.error} />
      <button className="btn btn-primary w-full" disabled={pending}>Entra</button>
    </form>
  );
}
