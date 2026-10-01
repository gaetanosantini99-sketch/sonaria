import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { consentLabel } from '@/lib/consent';
import { formatRome } from '@/lib/dates';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data: customer, error } = await supabase.from('customer_overview').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('Lettura cliente non riuscita', error);
    throw new Error('Errore temporaneo');
  }
  if (!customer) notFound();
  const { data: registrations, error: regError } = await supabase
    .from('registrations')
    .select('id, coupon_code, redeemed_at, created_at, consent_marketing, events(title, starts_at)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });
  if (regError) {
    console.error('Lettura registrazioni non riuscita', regError);
    throw new Error('Errore temporaneo');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{customer.first_name} {customer.last_name}</h1>
      <div className="card grid gap-2 sm:grid-cols-2">
        <p>Telefono: <b>{customer.phone_e164 ?? '—'}</b></p>
        <p>Offerte: <b>{consentLabel(customer.marketing_consent_until, new Date())}</b></p>
        <p>Primo contatto: <b>{customer.created_at ? formatRome(customer.created_at, 'dd/MM/yyyy') : '—'}</b></p>
        <p>Coupon usati: <b>{customer.redeemed_count} su {customer.events_count}</b></p>
      </div>
      <h2 className="font-bold">Serate</h2>
      <ul className="space-y-2">
        {(registrations ?? []).map((r) => (
          <li key={r.id} className="card flex flex-wrap justify-between gap-2">
            <span>{r.events?.title} · {r.events ? formatRome(r.events.starts_at, 'dd/MM/yyyy') : ''}</span>
            <span className="text-sm text-muted">
              <span className="font-mono">{r.coupon_code}</span> · {r.redeemed_at ? `usato ${formatRome(r.redeemed_at, 'HH:mm')}` : 'non usato'}
              {r.consent_marketing ? ' · consenso offerte' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
