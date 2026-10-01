import { expect, test } from '@playwright/test';

test('health check interroga il database', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('no-store');
  expect(await res.json()).toEqual({ ok: true });
});
