import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin } from './helpers';

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
