import { notFound } from 'next/navigation';
import { formatRome } from '@/lib/dates';
import { couponStatus } from '@/lib/event-window';
import { qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Il tuo coupon' };

export default async function CouponPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: reg, error } = await createAdminClient()
    .from('registrations')
    .select('coupon_code, redeemed_at, customers(first_name), events(title, venue_name, starts_at, ends_at, coupon_title, coupon_description)')
    .eq('coupon_token', token)
    .maybeSingle();
  if (error) {
    console.error('coupon lookup failed', error);
    throw new Error('Errore temporaneo');
  }
  if (!reg?.events) notFound();

  const event = reg.events;
  const status = couponStatus(reg.redeemed_at, event.ends_at, new Date());
  const qr = status === 'valid' ? await qrSvg(siteUrl(`/v/scan?code=${reg.coupon_code}`)) : null;
  const label =
    status === 'valid'
      ? 'Valido — mostralo al bancone'
      : status === 'redeemed'
        ? `Usato il ${formatRome(reg.redeemed_at!, "dd/MM 'alle' HH:mm")}`
        : 'Scaduto';

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8 text-center">
      <p className="text-muted">Ciao {reg.customers?.first_name}, ecco il tuo coupon per</p>
      <h1 className="text-2xl font-black">{event.title}</h1>
      <p className="text-muted">{event.venue_name} · {formatRome(event.starts_at)}</p>
      <section className="card space-y-4">
        <p className="text-xl font-bold text-accent">{event.coupon_title}</p>
        {event.coupon_description && <p className="text-sm text-muted">{event.coupon_description}</p>}
        <p data-testid="coupon-code" className="font-mono text-5xl font-black tracking-[0.2em]">{reg.coupon_code}</p>
        {qr && <div className="mx-auto w-56 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />}
        <p data-testid="coupon-status" className={`text-lg font-bold ${status === 'valid' ? 'text-ok' : 'text-danger'}`}>{label}</p>
      </section>
      <p className="text-sm text-muted">Salva questa pagina tra i preferiti: puoi riaprirla quando vuoi.</p>
    </main>
  );
}
