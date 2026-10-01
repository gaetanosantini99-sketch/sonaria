import { requireAdmin } from '@/lib/auth';
import { toCsv, type CsvColumn } from '@/lib/csv';
import { formatRome } from '@/lib/dates';
import type { Database } from '@/lib/supabase/database.types';

type Row = Database['public']['Views']['customer_overview']['Row'];

const date = (iso: string | null) => (iso ? formatRome(iso, 'dd/MM/yyyy') : '');

const COLUMNS: CsvColumn<Row>[] = [
  { header: 'Nome', value: (r) => r.first_name },
  { header: 'Cognome', value: (r) => r.last_name },
  { header: 'Telefono', value: (r) => r.phone_e164 },
  { header: 'Serate', value: (r) => r.events_count },
  { header: 'Coupon usati', value: (r) => r.redeemed_count },
  { header: 'Consenso offerte fino al', value: (r) => date(r.marketing_consent_until) },
  { header: 'Ultima attività', value: (r) => date(r.last_activity_at) },
  { header: 'Primo contatto', value: (r) => date(r.created_at) },
];

export async function GET() {
  const supabase = await requireAdmin();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('customer_overview').select('*').order('created_at').range(from, from + 999);
    if (error) {
      console.error('Export clienti non riuscito', error);
      return new Response('Errore durante l’export', { status: 500 });
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return new Response(toCsv(rows, COLUMNS), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clienti-${formatRome(new Date().toISOString(), 'yyyy-MM-dd')}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
