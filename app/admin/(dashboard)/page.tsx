import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatRome } from '@/lib/dates';
import { STATUS_LABEL, type EventStatus } from '@/lib/event-status';

export default async function DashboardPage() {
  const supabase = await requireAdmin();
  const nowIso = new Date().toISOString();
  const [customersRes, consentingRes, upcomingRes, statsRes] = await Promise.all([
    supabase.from('customer_overview').select('id', { count: 'exact', head: true }),
    supabase.from('customer_overview').select('id', { count: 'exact', head: true }).gt('marketing_consent_until', nowIso),
    supabase.from('events').select('id, title, venue_name, starts_at, status').gte('ends_at', nowIso).order('starts_at').limit(5),
    supabase.from('event_stats').select('event_id, registrations, redeemed'),
  ]);
  const failed = [customersRes, consentingRes, upcomingRes, statsRes].find((r) => r.error);
  if (failed?.error) {
    console.error('Lettura dashboard non riuscita', failed.error);
    throw new Error('Errore temporaneo');
  }
  const customers = customersRes.count;
  const consenting = consentingRes.count;
  const upcoming = upcomingRes.data;
  const statsById = new Map((statsRes.data ?? []).map((s) => [s.event_id, s]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card"><p className="text-sm text-muted">Clienti totali</p><p className="text-3xl font-black">{customers ?? 0}</p></div>
        <div className="card"><p className="text-sm text-muted">Con consenso offerte attivo</p><p className="text-3xl font-black">{consenting ?? 0}</p></div>
      </div>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Prossime serate</h2>
          <Link href="/admin/eventi/nuova" className="btn btn-primary">Nuova serata</Link>
        </div>
        {upcoming?.length ? (
          upcoming.map((e) => (
            <Link key={e.id} href={`/admin/eventi/${e.id}`} className="card flex flex-wrap justify-between gap-2 hover:border-accent">
              <span><b>{e.title}</b> <span className="text-muted">· {e.venue_name} · {formatRome(e.starts_at)}</span></span>
              <span className="text-sm">
                {STATUS_LABEL[e.status as EventStatus]} · {statsById.get(e.id)?.registrations ?? 0} registrati · {statsById.get(e.id)?.redeemed ?? 0} usati
              </span>
            </Link>
          ))
        ) : (
          <p className="text-muted">Nessuna serata in programma.</p>
        )}
      </section>
    </div>
  );
}
