import { notFound } from 'next/navigation';
import { formatRome } from '@/lib/dates';
import { getStaffSession } from '@/lib/staff-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logoutStaff } from '../actions';
import { PinForm } from '../pin-form';
import { RedeemForm } from '../redeem-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Area staff' };

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ staffToken: string }>;
  searchParams: Promise<{ expired?: string | string[] }>;
}) {
  const { staffToken } = await params;
  const { expired } = await searchParams;
  const { data: event, error } = await createAdminClient()
    .from('events')
    .select('title, venue_name, starts_at')
    .eq('staff_token', staffToken)
    .maybeSingle();
  if (error) {
    console.error('Lettura serata staff fallita', error);
    throw new Error('Errore temporaneo');
  }
  if (!event) notFound();

  const session = await getStaffSession();
  const authed = session?.staffToken === staffToken;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="text-center">
        <p className="text-sm text-muted">Area staff</p>
        <h1 className="text-2xl font-black">{event.title}</h1>
        <p className="text-muted">{event.venue_name} · {formatRome(event.starts_at)}</p>
      </header>
      {authed ? (
        <>
          <RedeemForm />
          <form action={logoutStaff.bind(null, staffToken)} className="text-center">
            <button className="text-sm text-muted underline">Esci</button>
          </form>
        </>
      ) : (
        <>
          {expired === '1' && (
            <p data-testid="session-expired" role="status" className="rounded-2xl bg-danger p-4 text-center font-bold text-white">
              Sessione scaduta: reinserisci il PIN
            </p>
          )}
          <PinForm staffToken={staffToken} />
        </>
      )}
    </main>
  );
}
