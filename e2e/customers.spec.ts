import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin, registerCustomer } from './helpers';

test('il PR trova, unisce ed esporta i clienti', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Clienti ${Date.now()}`, pin: '1234' });
  const lastName = `Doppione${Date.now().toString(36)}`;

  // stessa persona da due telefoni diversi, senza numero, scritta in modo diverso
  await registerCustomer(await browser.newPage(), event.publicPath, { firstName: 'Luca', lastName });
  await registerCustomer(await browser.newPage(), event.publicPath, { firstName: 'luca', lastName: lastName.toUpperCase() });

  await admin.goto(`/admin/clienti?q=${lastName}`);
  await expect(admin.locator('tbody tr')).toHaveCount(2);

  await admin.goto('/admin/clienti/doppioni');
  const pair = admin.getByTestId('duplicate-pair').filter({ hasText: lastName });
  await expect(pair).toHaveCount(1);
  await pair.getByRole('button', { name: 'Tieni questo' }).first().click();
  await expect(admin.getByTestId('duplicate-pair').filter({ hasText: lastName })).toHaveCount(0);

  await admin.goto(`/admin/clienti?q=${lastName}`);
  await expect(admin.locator('tbody tr')).toHaveCount(1);

  const res = await admin.request.get('/admin/clienti/export');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  expect((await res.text()).toLowerCase()).toContain(lastName.toLowerCase());

  await admin.goto('/admin');
  await expect(admin.getByText('Clienti totali')).toBeVisible();
});
