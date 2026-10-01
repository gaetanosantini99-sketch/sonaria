import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { consentLabel } from '@/lib/consent';
import { formatRome } from '@/lib/dates';
import { searchTerms } from '@/lib/search';

const PAGE_SIZE = 50;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const supabase = await requireAdmin();

  let query = supabase
    .from('customer_overview')
    .select('*', { count: 'exact' })
    .order('last_activity_at', { ascending: false })
    .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);
  for (const term of searchTerms(q)) {
    query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone_e164.ilike.%${term}%`);
  }
  const [{ data: customers, count, error }, { count: duplicates, error: duplicatesError }] = await Promise.all([
    query,
    supabase.from('duplicate_candidates').select('a_id', { count: 'exact', head: true }),
  ]);
  if (error || duplicatesError) {
    console.error('Lettura clienti non riuscita', error ?? duplicatesError);
    throw new Error('Errore temporaneo');
  }
  const now = new Date();
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (n: number) => `/admin/clienti?${new URLSearchParams({ q, page: String(n) })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Clienti ({count ?? 0})</h1>
        {/* download di un file da un route handler: deve essere un link normale, non una navigazione client */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/admin/clienti/export" className="btn btn-secondary">Esporta CSV</a>
      </div>
      {(duplicates ?? 0) > 0 && (
        <Link href="/admin/clienti/doppioni" className="card block hover:border-accent">
          ⚠️ {duplicates} possibili doppioni da controllare →
        </Link>
      )}
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Cerca nome, cognome o telefono" className="input" />
        <button className="btn btn-primary">Cerca</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr><th className="py-2">Nome</th><th>Telefono</th><th>Serate</th><th>Usati</th><th>Offerte</th><th>Ultima attività</th></tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2">
                  <Link href={`/admin/clienti/${c.id}`} className="font-semibold hover:text-accent">{c.first_name} {c.last_name}</Link>
                </td>
                <td>{c.phone_e164 ?? '—'}</td>
                <td>{c.events_count}</td>
                <td>{c.redeemed_count}</td>
                <td>{consentLabel(c.marketing_consent_until, now)}</td>
                <td>{c.last_activity_at ? formatRome(c.last_activity_at, 'dd/MM/yyyy') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-3">
          {pageNum > 1 && <Link href={pageHref(pageNum - 1)} className="btn btn-secondary">← Precedenti</Link>}
          <span className="text-muted">Pagina {pageNum} di {pages}</span>
          {pageNum < pages && <Link href={pageHref(pageNum + 1)} className="btn btn-secondary">Successivi →</Link>}
        </nav>
      )}
    </div>
  );
}
