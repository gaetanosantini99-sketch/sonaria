import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, loginAsAdmin } from './helpers';

test('le pagine admin richiedono il login', async ({ page }) => {
  await page.goto('/admin/eventi');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('password errata mostra un errore', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill('password-sbagliata');
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByText('Email o password non corretti')).toBeVisible();
});

test("login corretto e logout", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: 'Esci' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});
