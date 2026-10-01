'use client';

import { useActionState, type ReactNode } from 'react';
import { formatRome } from '@/lib/dates';
import { redeem, type RedeemResult, type RedeemState } from './actions';

function resultText(r: RedeemResult): string {
  switch (r.status) {
    case 'ok':
      return `✅ Coupon valido — ${r.couponTitle ?? ''}${r.firstName ? ` (${r.firstName})` : ''}`;
    case 'already_used':
      return `⛔ Già usato${r.redeemedAt ? ` alle ${formatRome(r.redeemedAt, 'HH:mm')}` : ''}`;
    case 'not_found':
      return '⛔ Codice non trovato';
    case 'out_of_window':
      return '⛔ Fuori orario della serata';
    case 'wrong_pin':
    case 'locked':
    case 'unauthorized':
      return '⚠️ Sessione scaduta: ricarica la pagina e reinserisci il PIN';
    default:
      return '⚠️ Errore, riprova';
  }
}

// Se `pinForm` è presente la sessione è assente: l'esito resta visibile (lo stato vive
// qui) anche quando la pagina, dopo la cancellazione del cookie, mostra il form del PIN.
export function RedeemForm({ defaultCode = '', pinForm }: { defaultCode?: string; pinForm?: ReactNode }) {
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeem, {});
  const r = state.result;
  return (
    <div className="space-y-4">
      {r && (
        <div
          data-testid="redeem-result"
          role="status"
          className={`rounded-2xl p-5 text-center text-xl font-bold ${r.status === 'ok' ? 'bg-ok text-black' : 'bg-danger text-white'}`}
        >
          <p>{resultText(r)}</p>
          <p className="mt-1 font-mono text-base opacity-80">{r.code}</p>
        </div>
      )}
      {pinForm ?? (
        <form action={action} className="card space-y-3">
          <label className="label" htmlFor="code">Codice coupon</label>
          <input
            id="code"
            name="code"
            defaultValue={defaultCode}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            className="input text-center font-mono text-3xl uppercase tracking-[0.3em]"
          />
          <button className="btn btn-primary w-full" disabled={pending}>Brucia coupon</button>
        </form>
      )}
    </div>
  );
}
