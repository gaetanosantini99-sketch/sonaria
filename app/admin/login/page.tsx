import { LoginForm } from './login-form';

export const metadata = { title: 'Accesso' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Area riservata</h1>
      {error === 'forbidden' && <p className="field-error mb-4">Questo account non è abilitato.</p>}
      <LoginForm />
    </main>
  );
}
