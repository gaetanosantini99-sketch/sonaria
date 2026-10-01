import { expect, type Page } from '@playwright/test';
import { formatInTimeZone } from 'date-fns-tz';

export const ADMIN_EMAIL = 'e2e-admin@example.test';
export const ADMIN_PASSWORD = 'e2e-password-1234';

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

export function romeInput(offsetMs: number): string {
  return formatInTimeZone(new Date(Date.now() + offsetMs), 'Europe/Rome', "yyyy-MM-dd'T'HH:mm");
}

export type CreatedEvent = { id: string; title: string; publicPath: string; staffPath: string };

export async function createLiveEvent(page: Page, { title, pin }: { title: string; pin: string }): Promise<CreatedEvent> {
  await page.goto('/admin/eventi/nuova');
  await page.getByLabel('Titolo serata').fill(title);
  await page.getByLabel('Locale').fill('Bar Test');
  await page.getByLabel('Inizio').fill(romeInput(-60 * 60 * 1000));
  await page.getByLabel('Fine').fill(romeInput(4 * 60 * 60 * 1000));
  await page.getByLabel('Titolo coupon').fill('Drink a 5€');
  await page.getByLabel('Descrizione coupon').fill('Valido per un drink');
  await page.getByLabel('PIN baristi', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Crea serata' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: 'Attiva', exact: true }).click();
  await expect(page.getByTestId('event-status')).toHaveText('Attiva');
  const id = page.url().split('/').pop()!;
  const publicPath = new URL(await page.getByTestId('public-url').innerText()).pathname;
  const staffPath = new URL(await page.getByTestId('staff-url').innerText()).pathname;
  return { id, title, publicPath, staffPath };
}

export async function registerCustomer(
  page: Page,
  publicPath: string,
  { firstName, lastName, phone = '' }: { firstName: string; lastName: string; phone?: string },
): Promise<string> {
  await page.goto(publicPath);
  await page.getByLabel('Nome', { exact: true }).fill(firstName);
  await page.getByLabel('Cognome', { exact: true }).fill(lastName);
  if (phone) await page.getByLabel('Telefono (facoltativo)').fill(phone);
  await page.getByLabel(/informativa privacy/).check();
  await page.getByLabel(/Accetto il coupon/).check();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Ottieni il coupon' }).click();
  await expect(page).toHaveURL(/\/c\//);
  return (await page.getByTestId('coupon-code').innerText()).trim();
}
