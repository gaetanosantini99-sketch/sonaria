import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin, registerCustomer } from './helpers';

test('il PR crea una serata, la attiva e scarica il QR', async ({ page }) => {
  await loginAsAdmin(page);
  const event = await createLiveEvent(page, { title: `Serata ${Date.now()}`, pin: '4321' });
  expect(event.publicPath).toMatch(/^\/e\/serata-\d+-[a-z2-9]{4}$/);
  expect(event.staffPath).toMatch(/^\/v\/[A-Za-z0-9_-]{22}$/);

  const png = await page.request.get(`/admin/eventi/${event.id}/qr?format=png`);
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toBe('image/png');

  await page.goto('/admin/eventi');
  await expect(page.getByText(event.title)).toBeVisible();
});

test('il form mostra gli errori di validazione', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/eventi/nuova');
  await page.getByRole('button', { name: 'Crea serata' }).click();
  await expect(page.getByText('Titolo obbligatorio')).toBeVisible();
  await expect(page.getByText('Data e ora obbligatorie').first()).toBeVisible();
});

test('una serata senza registrazioni si può eliminare, una con registrazioni no', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const empty = await createLiveEvent(admin, { title: `Elimina ${Date.now()}`, pin: '4321' });
  admin.once('dialog', (dialog) => dialog.accept());
  await admin.getByRole('button', { name: 'Elimina serata' }).click();
  await expect(admin).toHaveURL(/\/admin\/eventi$/);
  await expect(admin.getByText(empty.title)).toHaveCount(0);

  const used = await createLiveEvent(admin, { title: `Tieni ${Date.now()}`, pin: '4321' });
  await registerCustomer(await browser.newPage(), used.publicPath, { firstName: 'Sara', lastName: 'Blu' });
  await admin.goto(`/admin/eventi/${used.id}`);
  await expect(admin.getByRole('heading', { name: used.title })).toBeVisible();
  await expect(admin.getByRole('button', { name: 'Elimina serata' })).toHaveCount(0);
});
