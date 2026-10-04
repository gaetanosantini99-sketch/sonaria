import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from './turnstile';

const reply = (body: unknown, ok = true) => vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));

describe('verifyTurnstile', () => {
  it('true se Cloudflare conferma', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile('tok', 'sec', '1.2.3.4', f)).toBe(true);
    const body = (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get('remoteip')).toBe('1.2.3.4');
  });
  it('false se Cloudflare rifiuta', async () => {
    expect(await verifyTurnstile('tok', 'sec', null, reply({ success: false }))).toBe(false);
  });
  it('false senza token, senza chiamare Cloudflare', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile('', 'sec', null, f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('false su errore di rete', async () => {
    const f = vi.fn(async () => { throw new Error('rete'); });
    expect(await verifyTurnstile('tok', 'sec', null, f)).toBe(false);
  });
});
