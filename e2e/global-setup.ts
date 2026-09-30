import { ensureAdmin } from '../scripts/create-admin';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

export default async function globalSetup() {
  await ensureAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, ADMIN_EMAIL, ADMIN_PASSWORD);
}
