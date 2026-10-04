import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
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

test('un account non admin viene rifiutato', async ({ page }) => {
  const email = 'e2e-nonadmin@example.test';
  const password = 'e2e-password-1234';
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, { password });
  } else {
    const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
  }

  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByText('Questo account non è abilitato')).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});
