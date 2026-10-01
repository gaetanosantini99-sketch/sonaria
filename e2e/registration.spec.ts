import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin, registerCustomer } from './helpers';

test('il cliente ottiene il coupon e ritrova sempre lo stesso', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Registrazione ${Date.now()}`, pin: '1234' });
  const digits = String(Date.now()).slice(-7);

  const customer = await browser.newPage();
  const code = await registerCustomer(customer, event.publicPath, { firstName: 'Mario', lastName: 'Rossi', phone: `333 ${digits}` });
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  await expect(customer.getByTestId('coupon-status')).toContainText('Valido');
  const couponUrl = customer.url();

  // stesso dispositivo: il QR riporta al coupon già ottenuto
  await customer.goto(event.publicPath);
  await expect(customer).toHaveURL(couponUrl);

  // browser in-app senza cookie, stesso telefono scritto con +39: stesso coupon
  const inApp = await browser.newPage();
  const again = await registerCustomer(inApp, event.publicPath, { firstName: 'Mario', lastName: 'Rossi', phone: `+39 333${digits}` });
  expect(again).toBe(code);

  // il PR vede la registrazione
  await admin.goto(`/admin/eventi/${event.id}`);
  await expect(admin.getByRole('cell', { name: code })).toBeVisible();
});

test('senza consensi il form mostra gli errori', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Consensi ${Date.now()}`, pin: '1234' });

  const page = await browser.newPage();
  await page.goto(event.publicPath);
  await page.getByLabel('Nome', { exact: true }).fill('Anna');
  await page.getByLabel('Cognome', { exact: true }).fill('Verdi');
  await page.getByRole('button', { name: 'Ottieni il coupon' }).click();
  await expect(page.getByText("Devi accettare l'informativa privacy")).toBeVisible();
  await expect(page.getByText('Devi accettare le condizioni del coupon')).toBeVisible();
});

test('slug inesistente: pagina non trovata', async ({ page }) => {
  await page.goto('/e/non-esiste-xyz9');
  await expect(page.getByText('Pagina non trovata')).toBeVisible();
});
