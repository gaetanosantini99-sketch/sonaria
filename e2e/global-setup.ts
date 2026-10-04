import { ensureAdmin } from '../scripts/create-admin';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

// Gli e2e creano un admin con password nota e dati di prova: mai contro un database remoto.
const LOCAL_SUPABASE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/;

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!LOCAL_SUPABASE.test(url)) {
    throw new Error(`Gli e2e girano solo su Supabase locale (NEXT_PUBLIC_SUPABASE_URL=${url || 'non impostata'})`);
  }
  await ensureAdmin(url, process.env.SUPABASE_SECRET_KEY!, ADMIN_EMAIL, ADMIN_PASSWORD);
}
