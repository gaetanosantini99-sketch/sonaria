import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    const { error } = await createAdminClient().from('events').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error('health: errore database', error);
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
