import { requireAdmin } from '@/lib/auth';
import { qrPng, qrSvg } from '@/lib/qr';
import { siteUrl } from '@/lib/site';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data: event } = await supabase.from('events').select('slug').eq('id', id).maybeSingle();
  if (!event) return new Response('Serata non trovata', { status: 404 });

  const url = siteUrl(`/e/${event.slug}`);
  if (new URL(request.url).searchParams.get('format') === 'svg') {
    return new Response(await qrSvg(url), {
      headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="qr-${event.slug}.svg"` },
    });
  }
  return new Response(new Uint8Array(await qrPng(url)), {
    headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="qr-${event.slug}.png"` },
  });
}
