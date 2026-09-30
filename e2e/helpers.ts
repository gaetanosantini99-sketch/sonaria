import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = 'e2e-admin@example.test';
export const ADMIN_PASSWORD = 'e2e-password-1234';

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
