import { notFound, redirect } from 'next/navigation';
import { formatRome } from '@/lib/dates';
import { readDeviceId } from '@/lib/device';
import { env } from '@/lib/env';
import { isRegistrationOpen } from '@/lib/event-window';
import { createAdminClient } from '@/lib/supabase/admin';
import { RegisterForm } from './register-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Il tuo coupon per la serata' };

export default async function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, title, venue_name, starts_at, ends_at, coupon_title, coupon_description, status')
    .eq('slug', slug)
    .neq('status', 'draft')
    .maybeSingle();
  if (!event) notFound();

  const deviceId = await readDeviceId();
  if (deviceId) {
    const { data: existing } = await supabase
      .from('registrations')
      .select('coupon_token')
      .eq('event_id', event.id)
      .eq('device_id', deviceId)
      .limit(1)
      .maybeSingle();
    if (existing) redirect(`/c/${existing.coupon_token}`);
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="space-y-1 text-center">
        <h1 className="text-3xl font-black">{event.title}</h1>
        <p className="text-muted">{event.venue_name} · {formatRome(event.starts_at)}</p>
      </header>
      <section className="card text-center">
        <p className="text-xl font-bold text-accent">{event.coupon_title}</p>
        {event.coupon_description && <p className="mt-1 text-sm text-muted">{event.coupon_description}</p>}
      </section>
      {isRegistrationOpen(event, new Date()) ? (
        <RegisterForm slug={slug} siteKey={env('NEXT_PUBLIC_TURNSTILE_SITEKEY')} />
      ) : (
        <p className="card text-center">Le registrazioni per questa serata non sono aperte.</p>
      )}
    </main>
  );
}
