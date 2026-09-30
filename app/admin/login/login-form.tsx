'use client';

import { useActionState } from 'react';
import { FieldError } from '@/components/field-error';
import { login, type LoginState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <FieldError message={state.error} />
      <button className="btn btn-primary w-full" disabled={pending}>Accedi</button>
    </form>
  );
}
