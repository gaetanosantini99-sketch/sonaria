import { createClient } from '@supabase/supabase-js';

export async function ensureAdmin(url: string, secretKey: string, email: string, password: string): Promise<string> {
  const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  let userId = list.users.find((u) => u.email === email)?.id;
  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error: adminError } = await supabase.from('admins').upsert({ user_id: userId });
  if (adminError) throw adminError;
  return userId;
}

if (process.argv[1]?.endsWith('create-admin.ts')) {
  const [email, password] = process.argv.slice(2);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!email || !password || password.length < 12 || !url || !key) {
    console.error('Uso: npm run admin:create -- <email> <password di almeno 12 caratteri> (servono le env Supabase)');
    process.exit(1);
  }
  ensureAdmin(url, key, email, password)
    .then((id) => console.log(`Admin pronto: ${email} (${id})`))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
