import { expect, test } from '@playwright/test';
import { createLiveEvent, loginAsAdmin, registerCustomer } from './helpers';

test('il barista brucia un coupon una sola volta', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `Staff ${Date.now()}`, pin: '2468' });

  const customer = await browser.newPage();
  const code = await registerCustomer(customer, event.publicPath, { firstName: 'Giulia', lastName: 'Neri' });
  const couponUrl = customer.url();

  const staff = await browser.newPage();
  await staff.goto(event.staffPath);
  await staff.getByLabel('PIN').fill('0000');
  await staff.getByRole('button', { name: 'Entra' }).click();
  await expect(staff.getByText('PIN errato')).toBeVisible();
  await staff.getByLabel('PIN').fill('2468');
  await staff.getByRole('button', { name: 'Entra' }).click();

  await staff.getByLabel('Codice coupon').fill(` ${code.toLowerCase().slice(0, 3)}-${code.toLowerCase().slice(3)} `);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('redeem-result')).toContainText('Coupon valido');

  await staff.getByLabel('Codice coupon').fill(code);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('redeem-result')).toContainText('Già usato');

  await customer.goto(couponUrl);
  await expect(customer.getByTestId('coupon-status')).toContainText('Usato');

  // il barista inquadra il QR del coupon con la fotocamera: si apre /v/scan già compilato
  await staff.goto(`/v/scan?code=${code}`);
  await expect(staff.getByLabel('Codice coupon')).toHaveValue(code);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('redeem-result')).toContainText('Già usato');

  // il cliente che scansiona il proprio QR non entra nell'area staff
  await customer.goto(`/v/scan?code=${code}`);
  await expect(customer.getByText(/mostrare al bancone/)).toBeVisible();
});

test('se il PR cambia PIN, il barista deve reinserirlo', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `CambioPin ${Date.now()}`, pin: '1111' });

  const customer = await browser.newPage();
  const code = await registerCustomer(customer, event.publicPath, { firstName: 'Paolo', lastName: 'Gialli' });

  const staff = await browser.newPage();
  await staff.goto(event.staffPath);
  await staff.getByLabel('PIN').fill('1111');
  await staff.getByRole('button', { name: 'Entra' }).click();
  await expect(staff.getByLabel('Codice coupon')).toBeVisible();

  await admin.getByLabel(/Nuovo PIN baristi/).fill('2222');
  await admin.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(admin.getByText('Salvato ✓')).toBeVisible();

  await staff.getByLabel('Codice coupon').fill(code);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('session-expired')).toContainText('Sessione scaduta');
  await expect(staff.getByLabel('PIN')).toBeVisible();

  await staff.getByLabel('PIN').fill('2222');
  await staff.getByRole('button', { name: 'Entra' }).click();
  await expect(staff.getByTestId('session-expired')).toHaveCount(0);
  await staff.getByLabel('Codice coupon').fill(code);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('redeem-result')).toContainText('Coupon valido');
});

test('sessione obsoleta anche da /v/scan: torna al PIN', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `ScanPin ${Date.now()}`, pin: '3333' });

  const customer = await browser.newPage();
  const code = await registerCustomer(customer, event.publicPath, { firstName: 'Rita', lastName: 'Blu' });

  const staff = await browser.newPage();
  await staff.goto(event.staffPath);
  await staff.getByLabel('PIN').fill('3333');
  await staff.getByRole('button', { name: 'Entra' }).click();
  await expect(staff.getByLabel('Codice coupon')).toBeVisible();

  await admin.getByLabel(/Nuovo PIN baristi/).fill('4444');
  await admin.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(admin.getByText('Salvato ✓')).toBeVisible();

  await staff.goto(`/v/scan?code=${code}`);
  await staff.getByRole('button', { name: 'Brucia coupon' }).click();
  await expect(staff.getByTestId('session-expired')).toContainText('Sessione scaduta');
  await expect(staff.getByLabel('PIN')).toBeVisible();
});

test('PIN malformato: errore senza consumare tentativi', async ({ browser }) => {
  const admin = await browser.newPage();
  await loginAsAdmin(admin);
  const event = await createLiveEvent(admin, { title: `PinFmt ${Date.now()}`, pin: '5678' });

  const staff = await browser.newPage();
  await staff.goto(event.staffPath);
  for (let i = 0; i < 6; i++) {
    await staff.getByLabel('PIN').fill('abc');
    await staff.getByRole('button', { name: 'Entra' }).click();
    await expect(staff.getByText('PIN errato')).toBeVisible();
    await expect(staff.getByRole('button', { name: 'Entra' })).toBeEnabled();
  }
  await staff.getByLabel('PIN').fill('5678');
  await staff.getByRole('button', { name: 'Entra' }).click();
  await expect(staff.getByLabel('Codice coupon')).toBeVisible();
});
