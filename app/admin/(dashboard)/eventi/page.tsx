import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatRome } from '@/lib/dates';
import { STATUS_LABEL, type EventStatus } from '@/lib/event-status';

export default async function EventsPage() {
  const supabase = await requireAdmin();
  const [{ data: events }, { data: stats }] = await Promise.all([
    supabase.from('events').select('id, title, venue_name, starts_at, status').order('starts_at', { ascending: false }),
    supabase.from('event_stats').select('event_id, registrations, redeemed'),
  ]);
  const statsById = new Map((stats ?? []).map((s) => [s.event_id, s]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Serate</h1>
        <Link href="/admin/eventi/nuova" className="btn btn-primary">Nuova serata</Link>
      </div>
      {events?.length ? (
        <ul className="space-y-2">
          {events.map((e) => {
            const s = statsById.get(e.id);
            return (
              <li key={e.id}>
                <Link href={`/admin/eventi/${e.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-accent">
                  <span>
                    <b>{e.title}</b> <span className="text-muted">· {e.venue_name} · {formatRome(e.starts_at)}</span>
                  </span>
                  <span className="text-sm">
                    {STATUS_LABEL[e.status as EventStatus]} · {s?.registrations ?? 0} registrati · {s?.redeemed ?? 0} usati
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">Nessuna serata ancora.</p>
      )}
    </div>
  );
}
