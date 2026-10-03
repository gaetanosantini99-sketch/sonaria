import { notFound } from 'next/navigation';
import { CopyButton } from '@/components/copy-button';
import { requireAdmin } from '@/lib/auth';
import { formatRome, utcToRomeLocalInput } from '@/lib/dates';
import { EVENT_STATUSES, STATUS_ACTION_LABEL, STATUS_LABEL, type EventStatus } from '@/lib/event-status';
import { qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site';
import { ConfirmButton } from '@/components/confirm-button';
import { deleteEvent, setEventStatus, updateEvent } from '../actions';
import { EventForm } from '../event-form';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data: event } = await supabase
    .from('events')
    .select('id, slug, title, venue_name, starts_at, ends_at, coupon_title, coupon_description, staff_token, status')
    .eq('id', id)
    .maybeSingle();
  if (!event) notFound();

  const [{ data: stats }, { data: registrations }] = await Promise.all([
    supabase.from('event_stats').select('registrations, redeemed').eq('event_id', id).maybeSingle(),
    supabase
      .from('registrations')
      .select('id, coupon_code, redeemed_at, created_at, customers(first_name, last_name, phone_e164)')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const publicUrl = siteUrl(`/e/${event.slug}`);
  const staffUrl = siteUrl(`/v/${event.staff_token}`);
  const qr = await qrSvg(publicUrl);
  const status = event.status as EventStatus;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <span data-testid="event-status" className="rounded-full border border-border px-3 py-1 text-sm">{STATUS_LABEL[status]}</span>
      </header>
      <p className="text-muted">{event.venue_name} · {formatRome(event.starts_at)} → {formatRome(event.ends_at)}</p>

      <div className="flex flex-wrap gap-2">
        {EVENT_STATUSES.filter((s) => s !== status).map((s) => (
          <form key={s} action={setEventStatus.bind(null, event.id, s)}>
            <button className="btn btn-secondary">{STATUS_ACTION_LABEL[s]}</button>
          </form>
        ))}
        {(stats?.registrations ?? 0) === 0 && (
          <form action={deleteEvent.bind(null, event.id)}>
            <ConfirmButton className="btn btn-danger" message="Eliminare definitivamente questa serata?">
              Elimina serata
            </ConfirmButton>
          </form>
        )}
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-bold">QR per i clienti</h2>
          <div className="w-48 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
          <code data-testid="public-url" className="block break-all text-sm">{publicUrl}</code>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-secondary" href={`/admin/eventi/${event.id}/qr?format=png`}>Scarica PNG</a>
            <a className="btn btn-secondary" href={`/admin/eventi/${event.id}/qr?format=svg`}>Scarica SVG</a>
            <CopyButton text={publicUrl} label="Copia link" />
          </div>
        </div>
        <div className="card space-y-3">
          <h2 className="font-bold">Link per i baristi</h2>
          <p className="text-sm text-muted">Apri questo link sul telefono del bar e inserisci il PIN.</p>
          <code data-testid="staff-url" className="block break-all text-sm">{staffUrl}</code>
          <CopyButton text={staffUrl} label="Copia link staff" />
          <p className="text-lg">
            Registrati: <b>{stats?.registrations ?? 0}</b> · Usati: <b>{stats?.redeemed ?? 0}</b>
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Modifica serata</h2>
        <EventForm
          action={updateEvent.bind(null, event.id)}
          pinRequired={false}
          submitLabel="Salva modifiche"
          defaults={{
            title: event.title,
            venue_name: event.venue_name,
            starts_at: utcToRomeLocalInput(event.starts_at),
            ends_at: utcToRomeLocalInput(event.ends_at),
            coupon_title: event.coupon_title,
            coupon_description: event.coupon_description,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Registrazioni</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr><th className="py-2">Nome</th><th>Telefono</th><th>Codice</th><th>Usato</th></tr>
            </thead>
            <tbody>
              {(registrations ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2">{r.customers?.first_name} {r.customers?.last_name}</td>
                  <td>{r.customers?.phone_e164 ?? '—'}</td>
                  <td className="font-mono">{r.coupon_code}</td>
                  <td>{r.redeemed_at ? formatRome(r.redeemed_at, 'HH:mm') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
