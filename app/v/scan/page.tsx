import { normalizeCode } from '@/lib/codes';
import { getStaffSession } from '@/lib/staff-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { RedeemForm } from '../redeem-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Area staff' };

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = '' } = await searchParams;
  const session = await getStaffSession();
  let event: { title: string } | null = null;
  if (session) {
    const { data, error } = await createAdminClient()
      .from('events')
      .select('title')
      .eq('staff_token', session.staffToken)
      .maybeSingle();
    if (error) {
      console.error('Lettura serata scan fallita', error);
      throw new Error('Errore temporaneo');
    }
    event = data;
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="card">
          Questo è un coupon da mostrare al bancone. Se sei dello staff, apri prima il link della serata e inserisci il PIN.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="text-center">
        <p className="text-sm text-muted">Area staff</p>
        <h1 className="text-2xl font-black">{event.title}</h1>
      </header>
      <RedeemForm defaultCode={normalizeCode(code)} />
    </main>
  );
}
