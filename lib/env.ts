type EnvName =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  | 'SUPABASE_SECRET_KEY'
  | 'NEXT_PUBLIC_TURNSTILE_SITEKEY'
  | 'TURNSTILE_SECRET'
  | 'IP_HASH_SALT';

// Solo lato server: l'accesso dinamico non viene inlinato nel bundle client.
export function env(name: EnvName): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}
