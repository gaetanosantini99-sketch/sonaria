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
  admin.once('dialog', (dialog) => dialog.accept());
  await pair.getByRole('button', { name: 'Tieni questo' }).first().click();
  await expect(admin.getByTestId('duplicate-pair').filter({ hasText: lastName })).toHaveCount(0);

  await admin.goto(`/admin/clienti?q=${lastName}`);
  await expect(admin.locator('tbody tr')).toHaveCount(1);

  const res = await admin.request.get('/admin/clienti/export');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  expect(res.headers()['cache-control']).toContain('no-store');
  const body = await res.text();
  expect(body.startsWith('\uFEFFNome;Cognome;Telefono;')).toBe(true);
  expect(body.slice(1).split('\r\n')[0]).toBe(
    'Nome;Cognome;Telefono;Serate;Coupon usati;Consenso offerte fino al;Ultima attività;Primo contatto',
  );
  expect(body.toLowerCase()).toContain(lastName.toLowerCase());

  await admin.goto('/admin/clienti?page=999');
  await expect(admin.getByRole('heading', { name: /^Clienti/ })).toBeVisible();

  await admin.goto('/admin');
  await expect(admin.getByText('Clienti totali')).toBeVisible();
});

test('la ricerca ignora accenti e maiuscole', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Accenti ${Date.now()}`, pin: '1234' });
  const lastName = `Accento${Date.now().toString(36)}`;
  await registerCustomer(await browser.newPage(), event.publicPath, { firstName: 'Niccolò', lastName });

  await admin.goto(`/admin/clienti?q=niccolo%20${lastName.toLowerCase()}`);
  await expect(admin.locator('tbody tr')).toHaveCount(1);
  await admin.goto(`/admin/clienti?q=NICCOLÒ%20${lastName}`);
  await expect(admin.locator('tbody tr')).toHaveCount(1);
});

test("l'export non è accessibile senza login", async ({ browser }) => {
  const context = await browser.newContext();
  const res = await context.request.get('/admin/clienti/export');
  expect(res.headers()['content-type'] ?? '').not.toContain('text/csv');
  expect(res.url()).toContain('/admin/login');
  await context.close();
});
