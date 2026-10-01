import { requireAdmin } from '@/lib/auth';
import { formatRome } from '@/lib/dates';
import { mergeCustomers } from '../actions';

type Side = { id: string; firstName: string; lastName: string; phone: string | null; createdAt: string };

function KeepCard({ keep, drop }: { keep: Side; drop: Side }) {
  return (
    <div className="card flex-1 space-y-2">
      <p className="font-bold">{keep.firstName} {keep.lastName}</p>
      <p className="text-sm text-muted">{keep.phone ?? 'Senza telefono'} · dal {formatRome(keep.createdAt, 'dd/MM/yyyy')}</p>
      <form action={mergeCustomers.bind(null, keep.id, drop.id)}>
        <button className="btn btn-secondary">Tieni questo</button>
      </form>
    </div>
  );
}

export default async function DuplicatesPage() {
  const supabase = await requireAdmin();
  const { data: pairs, error } = await supabase.from('duplicate_candidates').select('*').limit(100);
  if (error) {
    console.error('Lettura doppioni non riuscita', error);
    throw new Error('Errore temporaneo');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Possibili doppioni</h1>
      <p className="text-muted">
        Stesso nome e cognome, almeno uno senza telefono. Scegli la scheda da tenere: l&apos;altra verrà unita a questa.
      </p>
      {pairs?.length ? (
        pairs.map((p) => {
          const a: Side = { id: p.a_id!, firstName: p.a_first_name!, lastName: p.a_last_name!, phone: p.a_phone, createdAt: p.a_created_at! };
          const b: Side = { id: p.b_id!, firstName: p.b_first_name!, lastName: p.b_last_name!, phone: p.b_phone, createdAt: p.b_created_at! };
          return (
            <div key={`${a.id}-${b.id}`} data-testid="duplicate-pair" className="flex flex-col gap-3 md:flex-row">
              <KeepCard keep={a} drop={b} />
              <KeepCard keep={b} drop={a} />
            </div>
          );
        })
      ) : (
        <p className="text-muted">Nessun possibile doppione.</p>
      )}
    </div>
  );
}
